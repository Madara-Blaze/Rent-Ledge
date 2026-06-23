/**
 * Money — an immutable value object for currency amounts.
 *
 * INVARIANTS (the spec calls money "sacred"):
 *  - Amounts are stored as **integer minor units** (paise for INR). Never floats.
 *  - Arithmetic is exact; rounding is explicit and uses round-half-away-from-zero
 *    on the minor unit, which is the conventional rule for invoices and tax.
 *  - Operations across different currencies throw rather than silently coerce.
 *
 * The canonical amount type is `bigint` so that large portfolio-level sums can
 * never lose precision (a JS number is only safe to 2^53). DTOs serialise the
 * amount as a base-10 string of minor units.
 */

export class CurrencyMismatchError extends Error {
  constructor(a: string, b: string) {
    super(`Currency mismatch: cannot combine ${a} with ${b}`);
    this.name = 'CurrencyMismatchError';
  }
}

export class InvalidMoneyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidMoneyError';
  }
}

/** Round |numer/denom| half-away-from-zero, preserving the sign of numer/denom. */
function divRoundHalfUp(numer: bigint, denom: bigint): bigint {
  if (denom === 0n) throw new InvalidMoneyError('Division by zero');
  // Normalise so the denominator is positive.
  if (denom < 0n) {
    numer = -numer;
    denom = -denom;
  }
  const negative = numer < 0n;
  const abs = negative ? -numer : numer;
  const q = abs / denom;
  const r = abs % denom;
  const rounded = r * 2n >= denom ? q + 1n : q;
  return negative ? -rounded : rounded;
}

export type MoneyInput = bigint | number | string;

export class Money {
  private constructor(
    public readonly amountMinor: bigint,
    public readonly currency: string,
  ) {}

  /** Build from an integer amount of minor units. Rejects non-integers. */
  static of(amount: MoneyInput, currency: string): Money {
    if (!currency || currency.length !== 3) {
      throw new InvalidMoneyError(`Currency must be an ISO-4217 code, got "${currency}"`);
    }
    let minor: bigint;
    if (typeof amount === 'bigint') {
      minor = amount;
    } else if (typeof amount === 'number') {
      if (!Number.isInteger(amount)) {
        throw new InvalidMoneyError(`Money amount must be an integer number of minor units, got ${amount}`);
      }
      minor = BigInt(amount);
    } else {
      if (!/^-?\d+$/.test(amount.trim())) {
        throw new InvalidMoneyError(`Money amount string must be an integer, got "${amount}"`);
      }
      minor = BigInt(amount.trim());
    }
    return new Money(minor, currency.toUpperCase());
  }

  /** Convenience constructor from a major-unit value, e.g. fromMajor(250.50, 'INR'). */
  static fromMajor(major: number, currency: string, minorPerMajor = 100): Money {
    const scaled = Math.round(major * minorPerMajor);
    if (Math.abs(scaled - major * minorPerMajor) > 1e-6) {
      throw new InvalidMoneyError(`Major amount ${major} is not representable in ${minorPerMajor} minor units`);
    }
    return Money.of(scaled, currency);
  }

  static zero(currency: string): Money {
    return Money.of(0n, currency);
  }

  static sum(items: Money[], currency?: string): Money {
    if (items.length === 0) {
      if (!currency) throw new InvalidMoneyError('Cannot sum an empty list without a currency');
      return Money.zero(currency);
    }
    return items.reduce((acc, m) => acc.add(m));
  }

  private assertSameCurrency(other: Money): void {
    if (this.currency !== other.currency) {
      throw new CurrencyMismatchError(this.currency, other.currency);
    }
  }

  add(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.amountMinor + other.amountMinor, this.currency);
  }

  subtract(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.amountMinor - other.amountMinor, this.currency);
  }

  negate(): Money {
    return new Money(-this.amountMinor, this.currency);
  }

  abs(): Money {
    return new Money(this.amountMinor < 0n ? -this.amountMinor : this.amountMinor, this.currency);
  }

  /** Multiply by an integer factor (e.g. number of months). */
  multiplyInt(factor: bigint | number): Money {
    if (typeof factor === 'number' && !Number.isInteger(factor)) {
      throw new InvalidMoneyError(`multiplyInt requires an integer factor, got ${factor}`);
    }
    const f = typeof factor === 'bigint' ? factor : BigInt(factor);
    return new Money(this.amountMinor * f, this.currency);
  }

  /** Percentage expressed in basis points: 200 bps = 2%, 1850 bps = 18.5%. */
  percentageBps(bps: number | bigint): Money {
    const b = typeof bps === 'bigint' ? bps : BigInt(bps);
    return new Money(divRoundHalfUp(this.amountMinor * b, 10_000n), this.currency);
  }

  /** value * numerator / denominator, rounded — used for day-based proration. */
  mulDivRound(numerator: number | bigint, denominator: number | bigint): Money {
    const n = typeof numerator === 'bigint' ? numerator : BigInt(numerator);
    const d = typeof denominator === 'bigint' ? denominator : BigInt(denominator);
    return new Money(divRoundHalfUp(this.amountMinor * n, d), this.currency);
  }

  /**
   * Split into parts by integer ratios without losing a single minor unit
   * (Fowler's allocation: floor each share, then hand the leftover minor units
   * one-by-one to the earliest parts). Requires a non-negative amount.
   */
  allocate(ratios: number[]): Money[] {
    if (ratios.length === 0) throw new InvalidMoneyError('allocate requires at least one ratio');
    if (this.amountMinor < 0n) throw new InvalidMoneyError('allocate requires a non-negative amount');
    if (ratios.some((r) => !Number.isInteger(r) || r < 0)) {
      throw new InvalidMoneyError('allocate ratios must be non-negative integers');
    }
    const total = ratios.reduce((a, b) => a + b, 0);
    if (total <= 0) throw new InvalidMoneyError('allocate ratios must sum to a positive number');
    const totalBig = BigInt(total);

    let remainder = this.amountMinor;
    const shares = ratios.map((r) => {
      const share = (this.amountMinor * BigInt(r)) / totalBig; // floor (amount >= 0)
      remainder -= share;
      return share;
    });
    for (let i = 0; remainder > 0n; i = (i + 1) % shares.length, remainder--) {
      shares[i] += 1n;
    }
    return shares.map((s) => new Money(s, this.currency));
  }

  // --- comparisons ---
  compare(other: Money): -1 | 0 | 1 {
    this.assertSameCurrency(other);
    if (this.amountMinor < other.amountMinor) return -1;
    if (this.amountMinor > other.amountMinor) return 1;
    return 0;
  }

  equals(other: Money): boolean {
    return this.currency === other.currency && this.amountMinor === other.amountMinor;
  }

  greaterThan(other: Money): boolean {
    return this.compare(other) === 1;
  }

  greaterThanOrEqual(other: Money): boolean {
    return this.compare(other) >= 0;
  }

  lessThan(other: Money): boolean {
    return this.compare(other) === -1;
  }

  lessThanOrEqual(other: Money): boolean {
    return this.compare(other) <= 0;
  }

  min(other: Money): Money {
    return this.lessThanOrEqual(other) ? this : other;
  }

  max(other: Money): Money {
    return this.greaterThanOrEqual(other) ? this : other;
  }

  isZero(): boolean {
    return this.amountMinor === 0n;
  }

  isNegative(): boolean {
    return this.amountMinor < 0n;
  }

  isPositive(): boolean {
    return this.amountMinor > 0n;
  }

  // --- serialisation ---
  toJSON(): { amountMinor: string; currency: string } {
    return { amountMinor: this.amountMinor.toString(), currency: this.currency };
  }

  toString(): string {
    return `${this.amountMinor.toString()} ${this.currency} (minor)`;
  }

  /** Human-readable, locale-aware formatting for receipts/notices. */
  format(locale = 'en-IN', minorPerMajor = 100): string {
    const major = Number(this.amountMinor) / minorPerMajor;
    return new Intl.NumberFormat(locale, { style: 'currency', currency: this.currency }).format(major);
  }
}
