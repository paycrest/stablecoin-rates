# Stablecoin-Rates

**Aggregating stablecoin-to-fiat exchange rates from multiple providers**

## 🚀 Overview

[Stablecoin-Rates](https://github.com/paycrest/stablecoin-rates) is a NestJS-based aggregation service that fetches and compares stablecoin-to-fiat exchange rates from different off-ramp providers. It helps users find the best rates for converting stable coins (USDT and USDC) into fiat currencies.

## 🔥 Features

- Real-time exchange rate aggregation from multiple providers
- Support for various stable coins and fiat currencies
- RESTful API for seamless integration

## 🏗 Tech Stack

- **Framework:** [NestJS](https://nestjs.com/)
- **Language:** TypeScript
- **Database:** PostgreSQL
- **HTTP Requests:** Axios

## 📦 Installation

### Prerequisites

Ensure you have the following installed:

- [Node.js](https://nodejs.org/) (LTS recommended)
- [NestJS CLI](https://docs.nestjs.com/cli/overview) (`npm install -g @nestjs/cli`)
- A database (PostgreSQL)

### Steps

```sh
# Clone the repository
git clone https://github.com/paycrest/stablecoin-rates.git

# Navigate into the project directory
cd stablecoin-rates

# Install dependencies
npm install

# Copy environment variables file
cp .env.example .env
```

## 🚀 Running the Application

This section provides instructions for running the **Stablecoin-Rates** application in different environments.

### Development

To start the application in development mode with hot-reloading:

```sh
npm run start:dev
```

### Production

To build and run the application in production::

```sh
npm run build
npm run start:prod
```

## ✅ Testing

Run unit and integration tests:

```sh
npm run test
```

Run tests with coverage:

```sh
npm run test:cov
```

## Contributing

We welcome contributions to the Paycrest Protocol! To get started, follow these steps:

**Important:** Before you begin contributing, please ensure you've read and understood these important documents:

- [Contribution Guide](https://paycrest.notion.site/Contribution-Guide-1602482d45a2809a8930e6ad565c906a) - Critical information about development process, standards, and guidelines.

- [Code of Conduct](https://paycrest.notion.site/Contributor-Code-of-Conduct-1602482d45a2806bab75fd314b381f4c) - Our community standards and expectations.

Our team will review your pull request and work with you to get it merged into the main branch of the repository.

If you encounter any issues or have questions, feel free to open an issue on the repository or leave a message in our [developer community on Telegram](https://t.me/+Stx-wLOdj49iNDM0)

## 📜 License

This project is licensed under the **GNU Affero General Public License v3.0 (AGPL-3.0)**.

By using, modifying, or distributing this software, you agree to comply with the terms of the **AGPL-3.0** license.

For more details, see the [LICENSE](LICENSE) file or visit:  
[https://www.gnu.org/licenses/agpl-3.0.html](https://www.gnu.org/licenses/agpl-3.0.html)
