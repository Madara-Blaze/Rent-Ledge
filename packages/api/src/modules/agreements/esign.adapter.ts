/**
 * e-Signature port. A live integration (Aadhaar eSign / DocuSign-style) plugs in
 * behind this interface; the mock lets the whole flow run without credentials.
 * Every signature captures signer identity, timestamp, IP and the document hash.
 */
export const ESIGN_PROVIDER = Symbol('ESIGN_PROVIDER');

export type SignerRole = 'LANDLORD' | 'TENANT' | 'GUARANTOR' | 'WITNESS';

export interface SignRequest {
  partyRole: SignerRole;
  name: string;
  identifier?: string;
  documentHash: string;
  ip?: string;
}

export interface SignResult {
  provider: string;
  providerRef: string;
  documentHash: string;
  signedAt: Date;
  status: 'SIGNED';
}

export interface ESignProvider {
  readonly name: string;
  sign(req: SignRequest): Promise<SignResult>;
}
