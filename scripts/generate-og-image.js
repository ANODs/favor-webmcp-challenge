const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

async function generateOgImage({ title, description, category, budget, deadline, publishedAt, imageUrl, fallbackGradient, botUsername, locale = 'ru' }) {
  const templatePath = path.join(__dirname, 'contract-og', locale === 'en' ? 'en.html' : 'ru.html');
  const htmlContent = fs.readFileSync(templatePath, 'utf8');
  
  const $ = cheerio.load(htmlContent);
  
  if (botUsername) $('#og-bot').text(`via @${botUsername}`);
  if (title) $('#og-title').text(title);
  if (description) $('#og-description').text(description);
  if (category) $('#og-category').text(category);
  if (budget) $('#og-budget').text(budget);
  if (deadline) $('#og-deadline').text(deadline);
  if (publishedAt) {
    const publishedLabel = $('#og-date').text().trim();
    $('#og-date').text(`${publishedLabel}: ${publishedAt}`);
  }
  if (fallbackGradient) {
    $('#og-image-placeholder').css({
      'background-color': fallbackGradient.backgroundColor,
      'background-image': fallbackGradient.backgroundImage,
    });
  }
  
  if (imageUrl) {
    try {
      const response = await fetch(imageUrl);
      if (response.ok) {
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const base64Image = buffer.toString('base64');
        const contentType = response.headers.get('content-type') || 'image/jpeg';
        const dataUri = `data:${contentType};base64,${base64Image}`;
        
        $('#og-image-el').attr('src', dataUri).removeClass('hidden');
        $('#og-image-placeholder').addClass('hidden');
      } else {
        console.error('Failed to fetch image:', response.status);
      }
    } catch (e) {
      console.error('Error fetching image:', e.message);
    }
  }
  
  const modifiedHtml = $.html();

  const chromiumPath = '/usr/bin/chromium';
  const executablePath = fs.existsSync(chromiumPath) ? chromiumPath : undefined;
  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  
  await page.setViewport({ width: 1200, height: 630 });
  
  // Set realistic User-Agent to avoid being blocked by CDNs (like Telegram's cdn4.telesco.pe)
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  
  try {
    await page.setContent(modifiedHtml, { waitUntil: 'load', timeout: 15000 });
  } catch (e) {
    console.warn("setContent timeout or error, proceeding to screenshot anyway:", e.message);
  }
  
  // Wait a little bit for any layout/fonts/images to finish rendering
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  const base64 = await page.screenshot({ type: 'png', encoding: 'base64' });
  
  await browser.close();
  
  return base64;
}

if (require.main === module) {
  const input = process.argv[2];
  if (!input) {
    console.error("No input JSON provided");
    process.exit(1);
  }
  
  try {
    const params = JSON.parse(input);
    generateOgImage(params).then(base64 => {
      // Write the base64 strictly to stdout
      process.stdout.write(base64);
    }).catch(err => {
      console.error("Failed to generate image:", err);
      process.exit(1);
    });
  } catch (err) {
    console.error("Failed to parse JSON input:", err);
    process.exit(1);
  }
}

module.exports = { generateOgImage };
