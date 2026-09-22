"""
RFC 6238 and RFC 4226 Test Vector Verification Script.
Validates the cryptographic math against standard IETF test vectors.
"""

import hmac
import hashlib
import struct
import base64

def generate_totp_test(secret_bytes, timestamp, period=30, digits=8, algo=hashlib.sha1):
    counter = timestamp // period
    msg = struct.pack(">Q", counter)
    h = hmac.new(secret_bytes, msg, algo).digest()
    offset = h[-1] & 0x0F
    code = struct.unpack(">I", h[offset:offset+4])[0] & 0x7FFFFFFF
    return f"{code % (10**digits):0{digits}d}"

def run_tests():
    # RFC 6238 Section B Test Vectors
    # Seed: 12345678901234567890 (ASCII, 20 bytes)
    secret_sha1 = b"12345678901234567890"
    b32 = base64.b32encode(secret_sha1).decode('ascii')
    print(f"Base32 Secret: {b32}")

    vectors = [
        (59, "94287082"),
        (1111111109, "07081804"),
        (1111111111, "14050471"),
        (1234567890, "89005924"),
        (2000000000, "69279037"),
    ]

    for ts, expected in vectors:
        calculated = generate_totp_test(secret_sha1, ts, period=30, digits=8, algo=hashlib.sha1)
        assert calculated == expected, f"Failed at {ts}: got {calculated}, expected {expected}"
        print(f"[PASS] Time {ts}: {calculated} == {expected}")

    print("All RFC 6238 test vectors verified successfully!")

if __name__ == "__main__":
    run_tests()
