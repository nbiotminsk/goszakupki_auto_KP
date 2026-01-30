# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a commercial proposal generator for the Belarusian government procurement portal (goszakupki.by). The system automatically parses procurement pages, generates professional PDF documents, and optionally sends them via Telegram.

## Commands

```bash
# Start production server (port 3001 by default, with auto-fallback)
npm start

# Development with auto-restart
npm run dev

# Test Telegram integration
npm run telegram:test

# Custom port
PORT=3001 npm start
```

**Note:** Node.js version must be >= 18.0.0 and <= 22.17.0

## Architecture

### Core Flow
1. **User enters URL** (goszakupki.by/marketing/view or goszakupki.by/single-source/view)
2. **Parser extracts data** from the procurement page using Puppeteer
3. **API enrichment** fetches company details from Belarusian tax API (grp.nalog.gov.by) using UNP
4. **PDF generator** renders HTML template with Handlebars, converts to PDF
5. **Optional Telegram delivery** sends the PDF with link to specified chat

### Key Modules

| File | Purpose |
|------|---------|
| `server.js` | Express server, browser initialization, API endpoints |
| `parser.js` | `GoszakupkiParser` - Puppeteer-based page scraping |
| `pdfGenerator.js` | `PDFGenerator` - Handlebars template rendering + PDF creation |
| `telegramSender.js` | `TelegramSender` - Telegram bot integration |
| `calculator-template.html` | Handlebars template for PDF output |

### Data Flow

```
Client Request → /generate or /api/generate-manual
    ↓
ensureBrowser() - reuse or restart Puppeteer instance
    ↓
Parser.parsePage(url) → Extract: company, UNP, address, lots, dates
    ↓
Optional: getCompanyDataFromAPI(UNP) → Tax API enrichment
    ↓
PDFGenerator.generatePDF(data) → Handlebars → Puppeteer print to PDF
    ↓
Response with fileName
    ↓
Optional: /send-to-telegram → TelegramSender
```

### Page Types Supported

- `/marketing/view/*` - Marketing procurement pages
- `/single-source/view/*` - Single source procurement
- `/request/view/*` - Request pages
- `/tender/view/*` - Tender pages
- `/contract/view/*` - Contract pages

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/generate` | Generate PDF from goszakupki.by URL |
| POST | `/api/generate-manual` | Generate PDF with manual data entry (supports product catalogs) |
| POST | `/api/save-catalog` | Save product catalog to `data/catalog.json` |
| GET | `/api/company/:unp` | Fetch company data from Belarusian tax API |
| POST | `/send-to-telegram` | Send generated PDF to Telegram chat |
| GET | `/telegram-status` | Check Telegram bot availability |
| GET | `/health` | Server health check |

### Manual Mode

The `/api/generate-manual` endpoint accepts:
- `lot1Items`/`lot2Items` - Arrays of `{name, quantity, price}` objects
- `skipUnpApi` - Boolean to skip UNP API lookup
- Saves product catalogs to `data/catalog.json` for autocomplete suggestions

### Browser Management

The server maintains a global Puppeteer browser instance (`browserInstance`) initialized at startup. The `ensureBrowser()` function handles reconnection if the browser disconnects. Each PDF generation or parsing operation creates a temporary page that is closed after completion.

### Template Variables

Key Handlebars placeholders in `calculator-template.html`:
- `COMPANY_NAME`, `UNP`, `ADDRESS` - Customer data
- `LOT_DESCRIPTION`, `LOT_COUNT`, `lot_unit` - First lot details
- `LOT_DESCRIPTION_2`, `LOT_COUNT_2`, `lot_unit_2` - Second lot (if exists)
- `PLACE`, `PAYMENT`, `END_DATE` - Procurement terms
- `FREE_DESCRIPTION` - User-provided notes
- `lot_1_items`, `lot_2_items` - Array of line items (for manual mode)
- `catalog` - Product catalog for autocomplete suggestions

### Error Handling

On parsing failures, the parser saves a screenshot (`error-screenshot-{timestamp}.png`) to the project root for debugging.

### Configuration

Environment variables (in `.env` or system):
- `PORT` - Server port (default 3001)
- `TELEGRAM_BOT_TOKEN` - Telegram bot token
- `TELEGRAM_CHAT_ID` - Default Telegram chat ID
- `HEADLESS` - Puppeteer headless mode (`false` for visible browser)
- `API_UNP_DISABLE` - Disable UNP API lookup
- `API_UNP_TIMEOUT_MS` - Tax API timeout (default 20000)
- `API_UNP_MAX_ATTEMPTS` - Tax API retry count (default 5)

### Known Issues / Edge Cases

- **Multi-lot detection**: Second lot detected by `<th class="lot-num">2</th>` presence
- **UNP 101223447**: Excluded from parsing (appears to be a test/placeholder value)
- **Port fallback**: Server auto-fallbacks to next port if selected port is in use (up to 5 attempts)
