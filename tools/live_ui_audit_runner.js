const { chromium, devices } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
    const outDir = path.join(process.cwd(), 'live_ui_audit_artifacts');
    fs.mkdirSync(outDir, { recursive: true });

    const browser = await chromium.launch({ headless: true });
    const desktopContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await desktopContext.newPage();

    const networkErrors = [];
    const consoleErrors = [];
    page.on('response', (r) => {
        if (r.status() >= 400) networkErrors.push({ url: r.url(), status: r.status() });
    });
    page.on('console', (m) => {
        if (m.type() === 'error') consoleErrors.push(m.text());
    });

    const result = {
        timestamp: new Date().toISOString(),
        baseUrl: 'https://www.jigri.in',
        desktop: {},
        auth: {},
        loggedIn: {},
        mobile: {},
        errors: {},
    };

    async function summarizePage(tag, screenshot = true) {
        await page.waitForTimeout(2200);
        const summary = await page.evaluate(() => {
            const pick = (sel) => Array.from(document.querySelectorAll(sel));
            const text = (el) => (el?.innerText || '').trim();
            const visible = (el) => {
                if (!el) return false;
                const r = el.getBoundingClientRect();
                const s = getComputedStyle(el);
                return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none';
            };

            const heading = pick('h1,h2').map((e) => text(e)).filter(Boolean).slice(0, 12);
            const navTexts = pick('nav a, aside a, [role="navigation"] a').map((e) => text(e)).filter(Boolean).slice(0, 60);
            const buttons = pick('button').map((e) => text(e)).filter(Boolean).slice(0, 80);
            const links = pick('a').map((e) => ({ text: text(e), href: e.getAttribute('href') || '' })).filter((l) => l.text).slice(0, 100);

            const main = document.querySelector('main');
            const mainRect = main ? main.getBoundingClientRect() : null;

            let posts = pick('article, [data-testid*=post], [class*=post-card], [class*=postCard], [class*=post]').filter(visible);
            if (posts.length < 2) {
                posts = pick('div').filter((el) => {
                    if (!visible(el)) return false;
                    const t = text(el);
                    return /like/i.test(t) && (/comment/i.test(t) || /share/i.test(t));
                });
            }

            const viewportH = window.innerHeight;
            const postRects = posts.slice(0, 10).map((p) => {
                const r = p.getBoundingClientRect();
                return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
            });
            const visiblePosts = posts.filter((p) => {
                const r = p.getBoundingClientRect();
                return r.bottom > 0 && r.top < viewportH;
            }).length;

            const asides = pick('aside').filter(visible).map((a) => {
                const r = a.getBoundingClientRect();
                return {
                    text: text(a).slice(0, 260),
                    x: Math.round(r.x),
                    y: Math.round(r.y),
                    w: Math.round(r.width),
                    h: Math.round(r.height),
                };
            });

            const imgs = pick('img');
            const brokenImgs = imgs.filter((i) => i.complete && i.naturalWidth === 0).length;
            const svgs = pick('svg');
            const tinySvgs = svgs.filter((s) => {
                const r = s.getBoundingClientRect();
                return r.width <= 1 || r.height <= 1;
            }).length;

            return {
                url: location.href,
                title: document.title,
                heading,
                navTexts,
                buttons,
                links,
                bodyTextSample: text(document.body).slice(0, 1800),
                mainRect: mainRect ? { x: Math.round(mainRect.x), y: Math.round(mainRect.y), w: Math.round(mainRect.width), h: Math.round(mainRect.height) } : null,
                postCountDetected: posts.length,
                visiblePosts,
                postRects,
                asides,
                brokenImgs,
                svgCount: svgs.length,
                tinySvgs,
                viewport: { w: window.innerWidth, h: window.innerHeight },
            };
        });

        if (screenshot) {
            await page.screenshot({ path: path.join(outDir, `${tag}.png`), fullPage: true });
        }
        return summary;
    }

    async function fillAuth(email, password) {
        const emailSelectors = [
            'input[type="email"]',
            'input[name*="email" i]',
            'input[placeholder*="email" i]',
        ];
        const passSelectors = [
            'input[type="password"]',
            'input[name*="password" i]',
            'input[placeholder*="password" i]',
        ];

        let filledEmail = false;
        for (const sel of emailSelectors) {
            const loc = page.locator(sel).first();
            if ((await loc.count()) > 0) {
                await loc.fill(email);
                filledEmail = true;
                break;
            }
        }

        const passLoc = page.locator(passSelectors.join(', '));
        const passCount = await passLoc.count();
        if (passCount > 0) {
            await passLoc.first().fill(password);
            if (passCount > 1) await passLoc.nth(1).fill(password);
        }

        return { filledEmail, passCount };
    }

    await page.goto('https://www.jigri.in', { waitUntil: 'domcontentloaded', timeout: 60000 });
    result.desktop.loggedOutHome = await summarizePage('01_logged_out_home_desktop');

    const signupEmail = `jigri.audit.${Date.now()}@example.com`;
    const signupPassword = 'JigriAudit#2026!';
    result.auth.signupAttempt = { email: signupEmail };

    try {
        await page.goto('https://www.jigri.in/sign-up', { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.waitForTimeout(1200);
        result.auth.signupForm = await summarizePage('02_signup_form_desktop');

        await fillAuth(signupEmail, signupPassword);
        const submitBtn = page.locator('button:has-text("Sign up"), button:has-text("Signup"), button:has-text("Create"), button[type="submit"], input[type="submit"]').first();
        if ((await submitBtn.count()) > 0) {
            await submitBtn.click({ timeout: 10000 });
            await page.waitForTimeout(4000);
        }
        result.auth.afterSignup = await summarizePage('03_after_signup_attempt_desktop');
    } catch (e) {
        result.auth.signupError = String(e.message || e);
    }

    let loggedInLikely = false;
    try {
        const urlNow = page.url();
        if (!/sign-in|sign-up|auth/i.test(urlNow)) {
            const body = await page.textContent('body');
            if (body && /(home|explore|profile|create post|logout|messages|settings)/i.test(body)) loggedInLikely = true;
        }

        if (!loggedInLikely) {
            await page.goto('https://www.jigri.in/sign-in', { waitUntil: 'domcontentloaded', timeout: 60000 });
            await page.waitForTimeout(1200);
            result.auth.signInForm = await summarizePage('04_signin_form_desktop');

            await fillAuth('test@test.com', '123456789');
            const signInBtn = page.locator('button:has-text("Sign in"), button:has-text("Login"), button[type="submit"], input[type="submit"]').first();
            if ((await signInBtn.count()) > 0) {
                await signInBtn.click({ timeout: 10000 });
                await page.waitForTimeout(5000);
            }
        }

        result.auth.afterLogin = await summarizePage('05_after_login_attempt_desktop');
        const url = page.url();
        const body = await page.textContent('body');
        loggedInLikely = !/sign-in|sign-up|auth/i.test(url) && /(home|explore|profile|post|messages|settings|create)/i.test(body || '');
    } catch (e) {
        result.auth.loginError = String(e.message || e);
    }
    result.auth.loggedInLikely = loggedInLikely;

    if (loggedInLikely) {
        await page.goto('https://www.jigri.in', { waitUntil: 'domcontentloaded', timeout: 60000 });
        result.loggedIn.feed = await summarizePage('06_logged_in_feed_desktop');

        try {
            const postLink = page.locator('a[href*="/posts/"]').first();
            if ((await postLink.count()) > 0) {
                await postLink.click({ timeout: 8000 });
                await page.waitForTimeout(2500);
            }
            result.loggedIn.postDetail = await summarizePage('07_post_detail_desktop');
        } catch (e) {
            result.loggedIn.postDetailError = String(e.message || e);
        }

        try {
            await page.goto('https://www.jigri.in/profile', { waitUntil: 'domcontentloaded', timeout: 60000 });
            result.loggedIn.profile = await summarizePage('08_profile_desktop');
        } catch (e) {
            result.loggedIn.profileError = String(e.message || e);
        }

        const statePath = path.join(outDir, 'auth-state.json');
        await desktopContext.storageState({ path: statePath });

        const mobileContext = await browser.newContext({ ...devices['iPhone 13'], storageState: statePath });
        const mPage = await mobileContext.newPage();
        mPage.on('response', (r) => {
            if (r.status() >= 400) networkErrors.push({ url: r.url(), status: r.status(), mobile: true });
        });

        await mPage.goto('https://www.jigri.in', { waitUntil: 'domcontentloaded', timeout: 60000 });
        await mPage.waitForTimeout(2200);
        result.mobile.feed = await mPage.evaluate(() => {
            const pick = (sel) => Array.from(document.querySelectorAll(sel));
            const text = (el) => (el?.innerText || '').trim();
            const visible = (el) => {
                if (!el) return false;
                const r = el.getBoundingClientRect();
                const s = getComputedStyle(el);
                return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none';
            };
            let posts = pick('article, [data-testid*=post], [class*=post-card], [class*=postCard], [class*=post]').filter(visible);
            if (posts.length < 2) {
                posts = pick('div').filter((el) => {
                    if (!visible(el)) return false;
                    const t = text(el);
                    return /like/i.test(t) && (/comment/i.test(t) || /share/i.test(t));
                });
            }
            const viewportH = window.innerHeight;
            const visiblePosts = posts.filter((p) => {
                const r = p.getBoundingClientRect();
                return r.bottom > 0 && r.top < viewportH;
            }).length;
            return {
                url: location.href,
                title: document.title,
                viewport: { w: window.innerWidth, h: window.innerHeight },
                postCountDetected: posts.length,
                visiblePosts,
                heading: pick('h1,h2').map((e) => text(e)).filter(Boolean).slice(0, 10),
                navTexts: pick('nav a, aside a').map((e) => text(e)).filter(Boolean).slice(0, 20),
                bodyTextSample: text(document.body).slice(0, 1600),
            };
        });
        await mPage.screenshot({ path: path.join(outDir, '09_mobile_feed.png'), fullPage: true });

        try {
            const mPost = mPage.locator('a[href*="/posts/"]').first();
            if ((await mPost.count()) > 0) {
                await mPost.click({ timeout: 8000 });
                await mPage.waitForTimeout(2500);
            }
            result.mobile.postDetail = await mPage.evaluate(() => {
                const text = (el) => (el?.innerText || '').trim();
                const pick = (sel) => Array.from(document.querySelectorAll(sel));
                return {
                    url: location.href,
                    title: document.title,
                    heading: pick('h1,h2').map((e) => text(e)).filter(Boolean).slice(0, 10),
                    bodyTextSample: text(document.body).slice(0, 1600),
                };
            });
            await mPage.screenshot({ path: path.join(outDir, '10_mobile_post_detail.png'), fullPage: true });
        } catch (e) {
            result.mobile.postDetailError = String(e.message || e);
        }

        await mobileContext.close();
    }

    result.errors.networkErrorsTop = networkErrors.slice(0, 120);
    result.errors.consoleErrorsTop = consoleErrors.slice(0, 120);

    fs.writeFileSync(path.join(outDir, 'live_ui_raw_findings.json'), JSON.stringify(result, null, 2));
    await desktopContext.close();
    await browser.close();
    console.log('done', path.join(outDir, 'live_ui_raw_findings.json'));
})();
