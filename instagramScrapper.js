const axios = require('axios-https-proxy-fix');
const fs = require('fs-extra');
const puppeteer = require('puppeteer');
const { Cluster } = require('puppeteer-cluster');

const checkIpApiUrlHttps = 'https://api.myip.com';
const checkIpApiUrlHttp = 'http://ip-api.com/json';

const MAX_INSTAGRAM_PROFILE_LINKS_NOT_DIE = 100;

const proxyArrayHttp = [
  {
    description: 'Brazil',
    url: '168.194.250.23',
    port: 80,
    working: false
  },
  {
    description: 'Russia',
    url: '94.78.196.91',
    port: 3128,
    working: false
  },
  {
    description: 'Poland',
    url: '79.191.11.165',
    port: 8080,
    working: false
  },
  {
    description: 'USA',
    url: '192.95.10.114',
    port: 8080,
    working: false
  }
];

const checkProxyHttp = async () => {
  let requestArray = [];

  for (let proxy of proxyArrayHttp) {
    const request = axios.get(checkIpApiUrlHttp, {
      proxy: {
        host: proxy.url,
        port: proxy.port
      },
      timeout: 120000
    });

    requestArray.push(request);
  }

  console.time('Check proxy');

  try {
    const result = await Promise.all(requestArray);

    for (let proxy of proxyArrayHttp) {
      const find = result.find(
        item =>
          item.status === 200 &&
          (item.data.ip === proxy.url || item.data.query === proxy.url)
      );

      if (!find) {
        proxy.working = false;
      }
      console.log(find.data.ip || find.data.query);
    }
  } catch (error) {
    console.log(error.message);
  }

  console.timeEnd('Check proxy');
};

////////////////////////////////////////////////////////////////////////////////
///
////////////////////////////////////////////////////////////////////////////////
class PersonCard {
  constructor(shortLink) {
    this.shortLink = shortLink;
  }
  /// short link from search result
  get shortLink() {
    return this._shortLink;
  }
  set shortLink(value) {
    this._shortLink = value;
  }

  /// full link to profile
  get profileLink() {
    return this._profileLink;
  }
  set profileLink(value) {
    this._profileLink = value;
  }

  /// full link to geo information
  get hrefGeo() {
    return this._hrefGeo;
  }
  set hrefGeo(value) {
    this._hrefGeo = value;
  }

  /// text geo information
  get textGeo() {
    return this._textGeo;
  }
  set textGeo(value) {
    this._textGeo = value;
  }

  /// number of publications
  get numberOfPublications() {
    return this._numberOfPublications;
  }
  set numberOfPublications(value) {
    this._numberOfPublications = value;
  }

  /// number of followers
  get numberOfFollowers() {
    return this._numberOfFollowers;
  }
  set numberOfFollowers(value) {
    this._numberOfFollowers = value;
  }

  /// number of following
  get numberOfFollowing() {
    return this._numberOfFollowing;
  }
  set numberOfFollowing(value) {
    this._numberOfFollowing = value;
  }

  /// profile description innerHtml
  get profileDescriptionInnerHtml() {
    return this._profileDescriptionInnerHtml;
  }
  set profileDescriptionInnerHtml(value) {
    this._profileDescriptionInnerHtml = value;
  }

  isFullProfile() {
    return (
      this._shortLink && this._profileLink
      // &&
      // (this._numberOfPublications ||
      //   this._numberOfFollowers ||
      //   this._numberOfFollowing ||
      //   this._profileDescriptionInnerHtml)
    );
  }
}

class InstagramHashScrapper {
  constructor(
    hashtag = 'Taganrog',
    numberOfUsers = 100,
    visible = false,
    proxy = false,
    instagramLogin,
    instagramPassword
  ) {
    this.numberOfUsers = numberOfUsers;
    this.hashtag = hashtag;
    this.visible = visible;
    this.proxy = proxy;
    this.instagramLogin = instagramLogin; // 'AbortBotBot',
    this.instagramPassword = instagramPassword; // 'm16om4ak1'
    this.resultTable = new Map();
    this.errorsCounter = 0;
    this.restartCounter = 0;
  }

  async initLibraries() {
    const concurrency = Cluster.CONCURRENCY_PAGE;
    // Cluster.CONCURRENCY_CONTEXT
    // Cluster.CONCURRENCY_BROWSER
    const maxConcurrency = 8;
    const retryLimit = 5;
    const retryDelay = 1500;
    const monitor = true;

    const puppeteerOptions = {
      // headless: false,
      // devtools: true
    };

    const clusterOptions = {
      concurrency,
      maxConcurrency,
      retryLimit,
      retryDelay,
      puppeteerOptions,
      monitor,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-web-security'
      ]
    };

    this._cluster = await Cluster.launch(clusterOptions);
  }

  async closeLibraries() {
    await this._cluster.close();
  }

  async loadData() {
    // profiler
    const startTime = Date.now();

    try {
      let puppeteerOptions = {
        headless: !this.visible,
        // devtools: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-web-security'
        ]
      };

      if (this.proxy) {
        puppeteerOptions.args = [
          ...puppeteerOptions.args,
          `--proxy-server=${proxyArrayHttp[1].url}:${proxyArrayHttp[1].port}`,
          `--ignore-certificate-errors`
        ];
      }

      this._browser = await puppeteer.launch(puppeteerOptions);

      this._browser.on('disconnected', err => {
        if (this.resultTable.size < this.numberOfUsers) {
          this.restartCounter++;
          console.error(`DISCONNECTED!!! restarting" ${err}`);
          setTimeout(async () => {
            await this.loadData();
          }, 1000);
          return;
        }
      });
      this._browser.on('targetdestroyed', function(err) {
        console.error(`Targetdestroyed ${err}`);
        // if (this.resultTable.size < this.numberOfUsers) {
        //   this.restartCounter++;
        //   console.error(`DISCONNECTED!!! restarting" ${err}`);
        //   setTimeout(async () => {
        //     await this.loadData();
        //   }, 1000);
        //   return;
        // }
      });

      let page;

      if (this.instagramLogin && this.instagramPassword) {
        page = await this.authentication();
      } else {
        page = await this.incognito();
      }

      if (!page) {
        throw new Error('Error in authentication');
      }

      page.on('pageerror', function(err) {
        console.error(`ERROR " ${err}`);
      });

      await this.initLibraries();
      await this.searchHashTag(page);
      await this.closeLibraries();
      await this._browser.close();

      const totalTime = Date.now() - startTime;

      const hour = Math.floor(totalTime / 1000 / 60 / 60);
      const min = Math.floor((totalTime - hour * 3600000) / 1000 / 60);
      const sec = Math.floor((totalTime - hour * 3600000 - min * 60000) / 1000);

      console.log(`*********************************************************`);
      console.error(`Total loading ${this.resultTable.size} profiles`);
      console.error(
        `Speed ${(totalTime / 1000 / this.resultTable.size).toFixed(
          2
        )} sec per profile`
      );
      console.error(`Time of work ${hour} hours : ${min} min : ${sec} sec`);
      console.error(`Loading profile errors: ${this.errorsCounter}`);
      if (this.restartCounter) {
        console.error(`Restarting ${this.restartCounter} times!`);
      }
      console.log(`*********************************************************`);
    } catch (error) {
      console.error(`Error in loadData method error=${error}`);
      await this._browser.close();
    }
  }

  async authentication() {
    try {
      const page = await this._browser.newPage();
      // disable image ??? try later
      // await page.setRequestInterception(true);
      // page.on('request', request => {
      //   if (
      //     ['image', 'stylesheet', 'font'].indexOf(request.resourceType()) !== -1
      //   ) {
      //     request.abort();
      //   } else {
      //     request.continue();
      //   }
      // });

      let previousSession;

      try {
        previousSession = JSON.parse(await fs.readFile('cookies.json'));
      } catch (err) {
        console.log('No cookie file found');
      }

      // if (previousSession) {
      //   await page.setCookie(previousSession);
      // }

      await page.goto('https://www.instagram.com/accounts/login/', {
        waitUntil: ['load', 'domcontentloaded'], //networkidle2
        timeout: 180000
      });

      // await page.setViewport({ width: 1024, height: 768 });
      const selectorInputLogin = 'input._2hvTZ.pexuQ.zyHYP';

      const selectorInputPassword = 'input[type="password"]._2hvTZ.pexuQ.zyHYP';
      const selectorLoginButton = 'button[type="submit"]._0mzm-.sqdOP.L3NKy';
      const selectorLoginNoNotifyButton = 'button.aOOlW.HoLwm';

      const selectorSearchPanel = 'nav > div > div > div > div > input';
      const selectorSearchPopup =
        'nav > div > div > div > div > div > div > div > a';

      await page.waitForSelector(selectorInputLogin);
      await page.type(selectorInputLogin, this.instagramLogin);
      await page.waitForSelector(selectorInputPassword);
      await page.type(selectorInputPassword, this.instagramPassword);
      await page.waitForSelector(selectorLoginButton);
      await page.click(selectorLoginButton);
      await page.waitForSelector(selectorLoginNoNotifyButton);
      await page.click(selectorLoginNoNotifyButton);
      await page.waitForSelector(selectorSearchPanel);
      await page.type(selectorSearchPanel, this.hashtag);
      await page.waitForSelector(selectorSearchPopup);
      await page.click(selectorSearchPopup);

      // save cookies
      const cookiesObject = await page.cookies();
      try {
        await fs.writeFile('cookies.json', JSON.stringify(cookiesObject));
      } catch (err) {
        console.log('Can`t cookie file write');
      }

      return page;
    } catch (error) {
      console.error(`Throw in searchHashTag error=${error}`);
      return null;
    }
  }

  async incognito() {
    try {
      const page = await this._browser.newPage();

      await page.goto(
        `https://www.instagram.com/explore/tags/${this.hashtag}`,
        {
          waitUntil: ['load', 'domcontentloaded'], //networkidle2
          timeout: 180000
        }
      );

      return page;
    } catch (error) {
      console.error(`Throw in searchHashTag error=${error}`);
      return null;
    }
  }

  async searchHashTag(page) {
    try {
      const selectorArrayOfTopPerson =
        'main > article > div > div > div > div > div > a';
      const selectorArrayOfRecentPerson =
        'main > article > div > div > div > div > a';

      let shotLinkSet = new Set();
      let prevShotLinkSet = new Set();

      /// Top posts
      await page.waitForSelector(selectorArrayOfTopPerson);
      const arrayLinkToPersonsHandle = await page.$$(selectorArrayOfTopPerson);

      for (let link of arrayLinkToPersonsHandle) {
        const href = await (await link.getProperty('href')).jsonValue();

        if (shotLinkSet.has(href)) {
          continue;
        } else {
          shotLinkSet.add(href);
        }
      }

      let counterScrapedLinks = 0;
      let tried = 0;

      do {
        await page.waitForSelector(selectorArrayOfRecentPerson);

        const arrayLinkToPersonsHandle = await page.$$(
          selectorArrayOfRecentPerson
        );

        for (let link of arrayLinkToPersonsHandle) {
          const href = await (await link.getProperty('href')).jsonValue();

          if (shotLinkSet.has(href) || prevShotLinkSet.has(href)) {
            continue;
          } else {
            shotLinkSet.add(href);
          }
          counterScrapedLinks++;
        }

        if (counterScrapedLinks >= MAX_INSTAGRAM_PROFILE_LINKS_NOT_DIE) {
          counterScrapedLinks = 0;

          if (shotLinkSet.size + this.resultTable.size > this.numberOfUsers) {
            let size = this.resultTable.size;
            for (let itemKey of shotLinkSet.keys()) {
              size++;
              if (size > this.numberOfUsers) {
                shotLinkSet.delete(itemKey);
              }
            }
          }

          await this.searchDetailInfo(shotLinkSet);

          prevShotLinkSet = shotLinkSet;
          shotLinkSet = new Set();
        }

        await this.scrollEndPage(page);

        console.log(
          `Person scrapped ${this.resultTable.size} tryed ${tried++}`
        );
      } while (this.resultTable.size < this.numberOfUsers);
    } catch (error) {
      console.error(`Throw in searchHashTag error=${error}`);
    }
  }

  async scrollEndPage(page) {
    try {
      await page.evaluate(() => {
        var spinner = document.querySelector(
          'section > main > article > div > div > svg'
        );
        spinner.scrollIntoView();
      });
    } catch (error) {
      console.log(`Throw in scrollEndPage error=${error.message}, continue...`);
    }
  }

  async searchDetailInfo(shotLinkSet) {
    try {
      let arrayUnicElement = new Map();

      for (let shortLink of shotLinkSet) {
        arrayUnicElement.set(shortLink, new PersonCard(shortLink));
      }

      // cluster.on('taskerror', (err, data) => {
      //   console.log(`Error crawling ${data}: ${err.message}`);
      //   // cluster.errorCount++;
      //   // cluster.queue(data);
      //   // throw new Error(data);
      // });

      const selectorProfileAddress =
        'article > header > div > div > div > h2 > a';
      const selectorProfileGeo = 'article > header > div > div > div > a';
      const selectorPageUnavailable = 'body > div > div > div > div > p > a';

      let errors = 0;

      const scrapInfoFirstStage = async ({ page, data: url }) => {
        /// ATTENTION!! IN INCOGNITO MODE ONLY!!!
        let hrefGeo = '';
        let textGeo = '';
        let profile = '';
        const person = arrayUnicElement.get(url);

        try {
          if (!person.profileLink) {
            await page.goto(url, {
              waitUntil: ['load', 'networkidle2'], //networkidle2 domcontentloaded
              timeout: 5000
            });

            const unavailable = await page.$(selectorPageUnavailable);
            if (unavailable) {
              return;
            }

            const aProfile = await page.waitForSelector(selectorProfileAddress);
            profile = await (await aProfile.getProperty('href')).jsonValue();

            const aGeo = await page.$$(selectorProfileGeo);
            if (aGeo && aGeo.length >= 2) {
              hrefGeo = await (await aGeo[1].getProperty('href')).jsonValue();
              textGeo = await (await aGeo[1].getProperty(
                'textContent'
              )).jsonValue();
            }
            person.profileLink = profile;
            person.hrefGeo = hrefGeo;
            person.textGeo = textGeo;
          }
        } catch (err) {
          console.log(`scrapInfoFirstStage: ${err.message}`);
          errors++;
          throw new Error('repeat');
        }
      };

      const scrapProfile = async ({ page, data: url }) => {
        /// ATTENTION!! IN INCOGNITO MODE ONLY!!!
        const selectorFollow =
          'main > div > header > section > ul > li > a > span';
        const selectorDescription =
          'main > div > header > section > div:last-child';

        try {
          const person = arrayUnicElement.get(url);

          await page.goto(person.profileLink, {
            waitUntil: ['load', 'networkidle2'], //networkidle2 domcontentloaded
            timeout: 5000
          });
          await page.waitForSelector(selectorDescription);

          const followUL = await page.$$(selectorFollow);

          const publications = await (await followUL[0].getProperty(
            'textContent'
          )).jsonValue();

          const followers = await (await followUL[1].getProperty(
            'textContent'
          )).jsonValue();

          const following = await (await followUL[2].getProperty(
            'textContent'
          )).jsonValue();

          const description = await (await (await page.$(
            selectorDescription
          )).getProperty('innerHTML')).jsonValue();

          person.numberOfPublications = publications;
          person.numberOfFollowers = followers;
          person.numberOfFollowing = following;
          person.profileDescriptionInnerHtml = description;
        } catch (err) {
          console.log(`scrapProfile ${err.message}`);
          errors++;
          throw new Error('repeat');
        }
      };

      for (let person of arrayUnicElement.values()) {
        // cluster.queue(person.shortLink);
        this._cluster.queue(person.shortLink, scrapInfoFirstStage);
      }

      await this._cluster.idle();
      // await cluster.close();

      if (errors) {
        console.log(`WE HAVE ${errors} errors in process`);
      } else {
        console.log(`WE HAVE NO errors in process!`);
      }

      // for (let person of arrayUnicElement.values()) {
      //   if (person.profileLink) {
      //     this._cluster.queue(person.shortLink, scrapProfile);
      //   }
      // }

      // await this._cluster.idle();
      // errors = 0;

      for (let person of arrayUnicElement.values()) {
        if (!person.isFullProfile()) {
          errors++;
        } else {
          this.resultTable.set(person.profileLink, person);
        }
      }

      if (errors) {
        console.log(`WE HAVE ${errors} not full profile`);
        this.errorsCounter += errors;
      } else {
        console.log(`WE HAVE NO empty profile!`);
      }
    } catch (error) {
      console.log(`Throw in searchDetailInfo error=${error}, continue...`);
    }
  }

  launch() {
    this.loadData();
  }
}

const loader = new InstagramHashScrapper('Fashionblogger', 200, true, false);
loader.launch();
