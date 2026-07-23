const puppeteer = require('puppeteer');
const path = require('path');

(async () => {
  try {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    const filePath = 'file:///' + path.resolve('report.html').replace(/\\/g, '/');
    await page.goto(filePath, { waitUntil: 'networkidle0' });
    await page.pdf({ 
      path: 'report.pdf', 
      format: 'A4',
      printBackground: true,
      margin: { top: '20px', right: '20px', bottom: '20px', left: '20px' }
    });
    await browser.close();
    console.log('PDF generated successfully at report.pdf');
  } catch (error) {
    console.error('Error generating PDF:', error);
  }
})();
