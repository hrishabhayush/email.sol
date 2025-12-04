# SolMail: Incentivized inbox for richer replies

<p align="center">
  <picture>
    <source srcset="Zero/apps/mail/public/solmail-logo-dark.png" media="(prefers-color-scheme: light)">
    <img src="Zero/apps/mail/public/solmail-logo.png" alt="SolMail Logo" width="64" style="background-color: #000; padding: 10px;"/>
  </picture>
</p>

<p align="center">
  <strong>An AI-powered email client built on Zero that sends micropayments upfront and refunds them if replies aren't meaningful, ensuring you pay solely for successful conversations.</strong>
</p>

## About SolMail

SolMail is an innovative email client that revolutionizes cold emailing by implementing a pay-for-success model. Built on the Zero email framework, SolMail ensures you only pay for meaningful email conversations.

### Problem

Cold emailing is inefficient and costly. You pay for emails that don't get meaningful replies, wasting resources on unsuccessful outreach campaigns.

### Solution

SolMail sends micropayments upfront and refunds them if replies aren't meaningful, ensuring you pay solely for successful conversations that drive real business value.

### Key Features

- **Pay for Success** - Send micropayments upfront, get refunds if replies aren't meaningful
- **AI-Powered** - Leverage AI to enhance your email experience
- **Built on Zero** - Powered by the open-source Zero email framework
- **Privacy First** - Your emails, your data
- **Fast & Reliable** - Lightning-fast interface and reliable delivery

## Getting Started

SolMail is built on top of the Zero email framework. To get started:

1. **Clone the repository**
   ```bash
   git clone https://github.com/hrishabhayush/email.sol.git
   cd email.sol
   ```

2. **Follow the Zero setup instructions**
   
   See the [Zero README](Zero/README.md) for detailed setup instructions, including:
   - Prerequisites and installation
   - Environment variable configuration
   - Database setup
   - Running the application

3. **Start developing**
   ```bash
   cd Zero
   pnpm install
   pnpm dev
   ```

## Project Structure

```
email.sol/
├── Zero/              # Zero email framework (base project)
│   ├── apps/
│   │   ├── mail/      # Mail application
│   │   └── server/     # Backend server
│   └── ...
└── README.md          # This file
```

## Technology Stack

SolMail inherits the robust technology stack from Zero:

- **Frontend**: React, TypeScript, TailwindCSS, React Router
- **Backend**: Node.js, Drizzle ORM
- **Database**: PostgreSQL
- **Authentication**: Better Auth, Google OAuth
- **Deployment**: Cloudflare Workers

## Contributing

Contributions are welcome! Please refer to the [Zero contributing guide](Zero/.github/CONTRIBUTING.md) for guidelines.

## License

This project is licensed under the same license as the Zero framework. See the [LICENSE](Zero/LICENSE) file for details.

## Links

- **Website**: [SolMail](https://solmail.com)
- **Base Framework**: [Zero](https://github.com/Mail-0/Zero)
- **Contributors**: See [Zero Contributors](https://0.email/contributors)

## Support

For issues, questions, or contributions, please refer to the Zero project's issue tracker and documentation.

---

<p align="center">
  Built with <a href="https://github.com/Mail-0/Zero">Zero</a>
</p>

