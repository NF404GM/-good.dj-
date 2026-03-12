const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', err => console.log('PAGE ERROR:', err.toString()));
    await page.goto('http://localhost:3000');

    console.log('App loaded. Waiting for library...');
    // wait for library rows to render
    await page.waitForSelector('.group', { timeout: 10000 }).catch(() => console.log("Timeout waiting for library"));

    // click the first track
    try {
        await page.click('.group');
        console.log('Clicked track row.');
    } catch (e) {
        console.log('Could not click track row', e);
    }

    // click LOAD A
    await await new Promise(r => setTimeout(r,)); // small delay for react to render the button
    const loaded = await page.$$('button');
    let loadBtn = null;
    for (let b of loaded) {
        if (await page.evaluate(el => el.textContent, b) === 'LOAD A') {
            loadBtn = b;
            break;
        }
    }
    if (loadBtn) {
        await loadBtn.click();
        console.log('Clicked LOAD A');
        await await new Promise(r => setTimeout(r,));
    } else {
        console.log('Could not find LOAD A button');
    }

    await browser.close();
})();
