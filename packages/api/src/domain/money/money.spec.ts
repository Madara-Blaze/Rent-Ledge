import { describe, expect, it } from 'vitest';
import { CurrencyMismatchError, InvalidMoneyError, Money } from './money';

const inr = (minor: number | bigint | string) => Money.of(minor, 'INR');

describe('Money construction', () => {
  it('accepts integer minor units', () => {
    expect(inr(5000).amountMinor).toBe(5000n);
    expect(inr('123456789012345').amountMinor).toBe(123456789012345n);
  });

  it('rejects non-integer numbers', () => {
    expect(() => inr(10.5)).toThrow(InvalidMoneyError);
  });

  it('rejects bad currency codes', () => {
    expect(() => Money.of(100, 'RUPEE')).toThrow(InvalidMoneyError);
  });

  it('builds from major units', () => {
    expect(Money.fromMajor(250.5, 'INR').amountMinor).toBe(25050n);
    expect(Money.fromMajor(20000, 'INR').amountMinor).toBe(2_000_000n);
  });
});

describe('Money arithmetic', () => {
  it('adds and subtracts', () => {
    expect(inr(5000).add(inr(2500)).amountMinor).toBe(7500n);
    expect(inr(5000).subtract(inr(2500)).amountMinor).toBe(2500n);
  });

  it('refuses to combine different currencies', () => {
    expect(() => inr(100).add(Money.of(100, 'USD'))).toThrow(CurrencyMismatchError);
    expect(() => inr(100).compare(Money.of(100, 'USD'))).toThrow(CurrencyMismatchError);
  });

  it('multiplies by integer factors only', () => {
    expect(inr(2_000_000).multiplyInt(12).amountMinor).toBe(24_000_000n);
    expect(() => inr(100).multiplyInt(1.5 as unknown as number)).toThrow(InvalidMoneyError);
  });

  it('sums a list', () => {
    expect(Money.sum([inr(100), inr(200), inr(300)]).amountMinor).toBe(600n);
    expect(Money.sum([], 'INR').isZero()).toBe(true);
  });
});

describe('Money percentage (basis points), round half away from zero', () => {
  it('2% of 5,000 paise = 100', () => {
    expect(inr(5000).percentageBps(200).amountMinor).toBe(100n);
  });

  it('2% of 12,345 paise = 247 (246.9 rounds up)', () => {
    expect(inr(12345).percentageBps(200).amountMinor).toBe(247n);
  });

  it('18% GST of 99,999 paise = 18,000 (17999.82 rounds up)', () => {
    expect(inr(99999).percentageBps(1800).amountMinor).toBe(18000n);
  });

  it('rounds .5 away from zero', () => {
    // 1% of 50 = 0.5 -> 1
    expect(inr(50).percentageBps(100).amountMinor).toBe(1n);
    // negative: 1% of -50 = -0.5 -> -1
    expect(inr(-50).percentageBps(100).amountMinor).toBe(-1n);
  });
});

describe('Money proration via mulDivRound', () => {
  it('half a 30-day month of 20,000 = 10,000', () => {
    expect(inr(2_000_000).mulDivRound(15, 30).amountMinor).toBe(1_000_000n);
  });

  it('11 of 30 days of 20,000 rounds correctly', () => {
    // 2_000_000 * 11 / 30 = 733333.33 -> 733333
    expect(inr(2_000_000).mulDivRound(11, 30).amountMinor).toBe(733_333n);
  });
});

describe('Money.allocate — lossless split', () => {
  it('splits 100 paise three ways without losing a unit', () => {
    const parts = inr(100).allocate([1, 1, 1]);
    expect(parts.map((p) => Number(p.amountMinor))).toEqual([34, 33, 33]);
    expect(Money.sum(parts).amountMinor).toBe(100n);
  });

  it('splits rent by weighted shares and conserves the total', () => {
    const parts = inr(1_000_001).allocate([2, 1]); // two tenants, 2:1 split
    expect(Money.sum(parts).amountMinor).toBe(1_000_001n);
    // Fowler's allocation hands the leftover minor unit to the earliest part.
    expect(parts[0].amountMinor).toBe(666_668n);
    expect(parts[1].amountMinor).toBe(333_333n);
  });

  it('rejects negative amounts and bad ratios', () => {
    expect(() => inr(-100).allocate([1, 1])).toThrow(InvalidMoneyError);
    expect(() => inr(100).allocate([0, 0])).toThrow(InvalidMoneyError);
  });
});

describe('Money comparisons', () => {
  it('orders and compares', () => {
    expect(inr(100).greaterThan(inr(50))).toBe(true);
    expect(inr(100).lessThanOrEqual(inr(100))).toBe(true);
    expect(inr(100).min(inr(50)).amountMinor).toBe(50n);
    expect(inr(100).max(inr(50)).amountMinor).toBe(100n);
    expect(inr(0).isZero()).toBe(true);
    expect(inr(-1).isNegative()).toBe(true);
  });
});

describe('Money serialisation', () => {
  it('serialises minor units as a string', () => {
    expect(inr(2_000_000).toJSON()).toEqual({ amountMinor: '2000000', currency: 'INR' });
  });
});
