# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Commercial proposal generator for Belarusian government procurement portal (goszakupki.by). Automatically parses procurement pages, generates professional PDF documents, and optionally sends them via Telegram.

## Commands

```bash
# Start production server (auto-fallbacks to next port if preferred is in use)
npm start

# Development with auto-restart
npm run dev

# Test Telegram integration
npm run telegram:test

# Custom port
PORT=3001 npm start
```

**Node.js:** >= 18.0.0 (tested up to 22.x)

## Architecture

### Core Flow
```
URL input → Parser extracts data → Tax API enrichment → Handlebars template → PDF → Optional Telegram
```

### Key Modules

| File | Purpose |
|------|---------|
| `server.js` | Express server, browser initialization, API endpoints |
| `parser.js` | `GoszakupkiParser` - Puppeteer page scraping, UNP API |
| `pdfGenerator.js` | `PDFGenerator` - Handlebars rendering + PDF creation |
| `telegramSender.js` | `TelegramSender` - Telegram bot integration |
| `calculator-template.html` | Handlebars template for PDF output |
| `selectors.json` | External CSS selectors for parsing page types |

### Page Types Supported

- `/marketing/view/*` - Marketing procurement
- `/single-source/view/*` - Single source procurement
- `/request/view/*` - Request pages
- `/tender/view/*` - Tender pages
- `/contract/view/*` - Contract pages

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/generate` | Generate PDF from goszakupki.by URL |
| POST | `/api/generate-manual` | Manual data entry with product catalogs |
| POST | `/api/save-catalog` | Save product catalog to `data/catalog.json` |
| GET | `/api/company/:unp` | Fetch company data from Belarusian tax API |
| POST | `/send-to-telegram` | Send PDF to Telegram chat |
| GET | `/telegram-status` | Check Telegram bot availability |
| GET | `/health` | Server health check |

### Browser Management

- Global Puppeteer `browserInstance` initialized at startup
- `ensureBrowser()` handles reconnection if disconnected
- Each operation creates a temporary page closed after completion
- Launch args: `--no-sandbox`, `--disable-dev-shm-usage`, `--disable-gpu`, plus 40+ stealth flags

### Server Maintenance

- **PDF cleanup**: Deletes files older than 24 hours on startup (`CLEANUP_HOURS`)
- **Port fallback**: Auto-tries next port if preferred is in use (up to 5 attempts)

## Data Flow

```
Client Request → /generate or /api/generate-manual
    ↓
ensureBrowser() - reuse or restart Puppeteer
    ↓
Parser.parsePage(url) → Extract: company, UNP, address, lots, dates
    ↓
getCompanyDataFromAPI(UNP) → Tax API enrichment (unless skipUnpApi)
    ↓
PDFGenerator.generatePDF(data) → Handlebars → Puppeteer print to PDF
    ↓
Response with fileName
    ↓
Optional: /send-to-telegram → TelegramSender
```

## UNP API Behavior

Requests to `grp.nalog.gov.by` use:
- **Retry**: Exponential backoff with jitter (base 1s, max 10s, up to 5 attempts)
- **Timeout**: 20s per request (`API_UNP_TIMEOUT_MS`)
- **Validation**: 9-digit UNP required, rejects invalid formats
- **9-digit UNP 101223447**: Excluded from parsing (test value)

## Template Variables

Key Handlebars placeholders in `calculator-template.html`:

| Variable | Description |
|----------|-------------|
| `COMPANY_NAME`, `UNP`, `ADDRESS` | Customer data |
| `LOT_DESCRIPTION`, `LOT_COUNT`, `lot_unit` | First lot |
| `LOT_DESCRIPTION_2`, `LOT_COUNT_2`, `lot_unit_2` | Second lot (if exists) |
| `PLACE`, `PAYMENT`, `END_DATE` | Procurement terms |
| `FREE_DESCRIPTION` | User-provided notes |
| `lot_1_items`, `lot_2_items` | Line items array (manual mode) |
| `catalog` | Product catalog for autocomplete |

**Helpers:** `{{formatNumber}}`, `{{multiply a b}}`, `{{increment index}}`

## Manual Mode

`/api/generate-manual` accepts:
- `lot1Items`/`lot2Items`: Arrays of `{name, quantity, price}`
- `skipUnpApi`: Boolean to skip UNP API lookup
- Saves product catalogs to `data/catalog.json` for autocomplete suggestions

## Configuration

Environment variables (in `.env`):

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3001 | Server port |
| `TELEGRAM_BOT_TOKEN` | - | Telegram bot token |
| `TELEGRAM_CHAT_ID` | - | Default Telegram chat ID |
| `HEADLESS` | "new" | Puppeteer headless mode ("false" for visible) |
| `API_UNP_DISABLE` | false | Disable UNP API lookup |
| `API_UNP_TIMEOUT_MS` | 20000 | Tax API timeout |
| `API_UNP_MAX_ATTEMPTS` | 5 | Tax API retry count |
| `CLEANUP_HOURS` | 24 | PDF cleanup age threshold |
| `PORT_FALLBACK_ATTEMPTS` | 5 | Port fallback attempts |

## Error Handling

- Parsing failures save screenshots (`error-screenshot-{timestamp}.png`) to project root
- Network errors trigger automatic retry with exponential backoff
- Parser includes detailed debug info in response (`DEBUG_INFO`)

## Known Edge Cases

- **Multi-lot detection**: Second lot detected by `<th class="lot-num">2</th>` presence
- **Multi-lot selectors**: 2nd lot uses `tr:nth-of-type(3)` in `#lotsList`
- **Request pages**: Company name/address obtained from UNP API, not page parsing
- **Image fallback**: `logo.png` and `pechat.png` fallback to `.jpg`/`.jpeg` formats

## Static Assets

| Path | Purpose |
|------|---------|
| `/images` | Logo and stamp images for PDF |
| `/data/catalog.json` | Product catalog for autocomplete |
| `/generated` | Generated PDF files (auto-cleaned) |
