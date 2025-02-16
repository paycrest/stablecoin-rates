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

## 🤝 Contributing

We welcome contributions! Follow these steps:

1. **Fork the repository**
2. **Create a new branch** (`feat/add-new-provider`)
3. **Commit your changes** (`git commit -m "feat: add new provider"`)
4. **Push your branch**
5. **Create a Pull Request (PR)**

Please follow the [contribution guidelines](CONTRIBUTING.md) before submitting changes.

## 📜 License

This project is licensed under the **GNU Affero General Public License v3.0 (AGPL-3.0)**.

By using, modifying, or distributing this software, you agree to comply with the terms of the **AGPL-3.0** license.

For more details, see the [LICENSE](LICENSE) file or visit:  
[https://www.gnu.org/licenses/agpl-3.0.html](https://www.gnu.org/licenses/agpl-3.0.html)
