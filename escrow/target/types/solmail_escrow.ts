/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/solmail_escrow.json`.
 */
export type SolmailEscrow = {
  "address": "Cx6XKyjVT5oipy3gdko2A7R4oJYc5ENUqgMapBF7zxkb",
  "metadata": {
    "name": "solmailEscrow",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Escrow program for SolMail incentivized replies"
  },
  "docs": [
    "The escrow program powering SolMail's incentivized replies."
  ],
  "instructions": [
    {
      "name": "initializeEscrow",
      "docs": [
        "Initialize an escrow account for a given email thread.",
        "",
        "- `thread_id` is a 32-byte identifier derived from the email thread (e.g. a hash).",
        "- `amount` is the number of lamports the sender wants to escrow."
      ],
      "discriminator": [
        243,
        160,
        77,
        153,
        11,
        92,
        48,
        209
      ],
      "accounts": [
        {
          "name": "sender",
          "docs": [
            "The sender funding the escrow."
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "escrow",
          "docs": [
            "PDA that will hold the escrowed lamports and state."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  115,
                  99,
                  114,
                  111,
                  119
                ]
              },
              {
                "kind": "account",
                "path": "sender"
              },
              {
                "kind": "arg",
                "path": "threadId"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "docs": [
            "System program for creating the account and transferring lamports."
          ],
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "threadId",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "escrow",
      "discriminator": [
        31,
        213,
        123,
        187,
        186,
        22,
        218,
        155
      ]
    }
  ],
  "types": [
    {
      "name": "escrow",
      "docs": [
        "Escrow account storing all data needed to manage the incentive."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "sender",
            "docs": [
              "Wallet that funded the escrow."
            ],
            "type": "pubkey"
          },
          {
            "name": "receiver",
            "docs": [
              "Wallet that will eventually receive the funds (set on claim)."
            ],
            "type": "pubkey"
          },
          {
            "name": "threadId",
            "docs": [
              "Deterministic identifier for the email thread."
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "amount",
            "docs": [
              "Amount of lamports escrowed."
            ],
            "type": "u64"
          },
          {
            "name": "createdAt",
            "docs": [
              "Unix timestamp when the escrow was created."
            ],
            "type": "i64"
          },
          {
            "name": "expiresAt",
            "docs": [
              "Unix timestamp after which the sender can refund."
            ],
            "type": "i64"
          },
          {
            "name": "status",
            "docs": [
              "Current status of the escrow."
            ],
            "type": {
              "defined": {
                "name": "escrowStatus"
              }
            }
          },
          {
            "name": "bump",
            "docs": [
              "PDA bump."
            ],
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "escrowStatus",
      "docs": [
        "Simple status enum so we can extend behavior later."
      ],
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "pending"
          },
          {
            "name": "completed"
          },
          {
            "name": "refunded"
          }
        ]
      }
    }
  ]
};
