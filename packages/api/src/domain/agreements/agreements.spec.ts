import { describe, expect, it } from 'vitest';
import { INDIA_DEFAULT_POLICY } from '../policy/india-default.policy';
import { agreementHash } from './hash';
import { assessRegistration } from './registration';
import { interpolate, renderClauses } from './template';

describe('template interpolation', () => {
  it('fills variables and leaves placeholders for missing ones', () => {
    const r = interpolate('Rent is {{rent}} payable by {{tenantName}}.', { rent: '₹55,000', tenantName: '' });
    expect(r.text).toBe('Rent is ₹55,000 payable by {{tenantName}}.');
    expect(r.missing).toEqual(['tenantName']);
  });

  it('renders and numbers a clause list', () => {
    const r = renderClauses(
      [
        { key: 'parties', title: 'Parties', body: '{{landlordName}} lets to {{tenantName}}.' },
        { key: 'rent', title: 'Rent', body: 'Monthly rent {{rent}}.' },
      ],
      { landlordName: 'A', tenantName: 'B', rent: '₹55,000' },
    );
    expect(r.clauses).toHaveLength(2);
    expect(r.text).toContain('1. Parties');
    expect(r.text).toContain('2. Rent');
    expect(r.text).toContain('A lets to B.');
    expect(r.missing).toEqual([]);
  });
});

describe('registration assessment', () => {
  it('does not require registration for an 11-month term', () => {
    const a = assessRegistration(11, INDIA_DEFAULT_POLICY);
    expect(a.registrationRequired).toBe(false);
    expect(a.defaultTermMonths).toBe(11);
  });

  it('requires registration above 11 months', () => {
    const a = assessRegistration(12, INDIA_DEFAULT_POLICY);
    expect(a.registrationRequired).toBe(true);
  });

  it('flags Rent Authority filing when policy sets a window', () => {
    const a = assessRegistration(11, INDIA_DEFAULT_POLICY);
    expect(a.rentAuthorityRequired).toBe(true);
    expect(a.rentAuthorityFilingDays).toBe(60);
  });
});

describe('agreement content hash', () => {
  it('is deterministic and order-independent for variables', () => {
    const h1 = agreementHash('the agreement', { a: '1', b: '2' });
    const h2 = agreementHash('the agreement', { b: '2', a: '1' });
    expect(h1).toBe(h2);
  });

  it('changes when the document text changes', () => {
    const h1 = agreementHash('v1', { a: '1' });
    const h2 = agreementHash('v2', { a: '1' });
    expect(h1).not.toBe(h2);
  });
});
