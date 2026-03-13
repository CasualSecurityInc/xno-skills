import qrcode from 'qrcode-terminal';

/**
 * Generates an ASCII QR code for a Nano address.
 * 
 * @param address - The Nano address (xrb_ or nano_ prefix)
 * @param amount - Optional amount in Nano (not raw)
 * @returns ASCII string representation of the QR code
 */
export function generateAsciiQr(address: string, amount?: number): Promise<string> {
  let uri = `nano:${address}`;
  
  if (amount !== undefined && amount > 0) {
    // Amount should be in raw (smallest unit)
    // Convert Nano to raw: multiply by 10^30
    const rawAmount = BigInt(Math.floor(amount * 1e30)).toString();
    uri += `?amount=${rawAmount}`;
  }
  
  return new Promise((resolve) => {
    qrcode.generate(uri, { small: true }, (qrcodeString) => {
      resolve(qrcodeString);
    });
  });
}