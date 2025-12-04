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
    "The escrow program powering SolMail's incentivized replies.",
    "",
    "Step 1: we only scaffold the data structures and a no-op initialize",
    "instruction so you can ensure the program compiles and deploys.",
    "In the next step we will wire in real SOL transfers and the 15-day expiry."
  ],
  "instructions": [
    {
      "name": "initializePlaceholder",
      "docs": [
        "Placeholder initialize instruction so you can test build/deploy wiring."
      ],
      "discriminator": [
        218,
        34,
        131,
        48,
        148,
        6,
        59,
        148
      ],
      "accounts": [],
      "args": []
    }
  ]
};
