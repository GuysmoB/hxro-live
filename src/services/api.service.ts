
export class ApiService {

  constructor() { }

  getDataFromApi(): Promise<any> {
    return new Promise<any>(async (resolve, reject) => {
      const axios = require('axios').default;
      const res = await axios.get("https://btc.history.hxro.io/1m");
      if (res) {
        resolve(res.data);
      } else {
        reject();
      }
    });
  }


  getSeriesId(token: string): Promise<any> {
    return new Promise<any>(async (resolve, reject) => {
      const contestPair = "BTC/USD";
      const contestDuration = "00:01:00";
      const assetType = "HXRO";
      const apiToken = token;

      const https = require('https');
      const options = {
        hostname: 'api.hxro.io',
        port: 443,
        path: '/hxroapi/api/contestseries/running',
        method: 'GET',
        headers: {
          'Ocp-Apim-Subscription-Key': apiToken
        }
      }

      function getSeries(seriesObj) {
        return seriesObj.name == contestPair &&
          seriesObj.contestDuration == contestDuration &&
          seriesObj.assetType == assetType;
      };

      const req = https.request(options, (res) => {
        var arr = "";
        res.on('data', (part) => {
          arr += part;
        });

        res.on('end', () => {
          var seriesArr = JSON.parse(arr)
          var series = seriesArr.filter(getSeries);
          var ret;
          if (series[0] && 'id' in series[0]) {
            ret = series[0].id;
          } else {
            ret = "[Error]: Matching series not found.";
          }

          resolve(ret);
        });
      });

      req.on('error', (e) => {
        console.error(e);
        reject(e);
      });

      req.end();
    });
  }

  getContestId(apiToken: string, seriesId: string) {
    console.log('seriesId', seriesId)
    const https = require('https');
    const options = {
      hostname: 'api.hxro.io',
      port: 443,
      path: '/hxroapi/api/contests/by-series/' + seriesId,
      method: 'GET',
      headers: {
        'Ocp-Apim-Subscription-Key': apiToken
      }
    }

    const req = https.request(options, (res) => {
      var arr = "";
      res.on('data', (part) => {
        arr += part;
      });

      res.on('end', () => {
        var seriesArr = JSON.parse(arr);
        for (let i = 0; i <= seriesArr.length; i++) {
          console.log(seriesArr[i]);
        }
      });
    });

    req.on('error', (e) => {
      console.error(e);
    });

    req.end();
  }

  getContestsBySeriesId(seriesId: string) {
    const fetch = require('node-fetch');

    const url = 'http://api.hxro.io/hxroapi/api/Contests/by-series/' + seriesId;
    const options = { method: 'GET', headers: { Accept: 'text/plain' } };

    fetch(url, options)
      .then(res => res.json())
      .then(json => console.log(json))
      .catch(err => console.error('error:' + err));
  }


  getRunningContestSeries() {
    const fetch = require('node-fetch');

    const url = 'http://api.hxro.io/hxroapi/api/ContestSeries/running';
    const options = { method: 'GET', headers: { Accept: 'text/plain' } };

    fetch(url, options)
      .then(res => res.json())
      .then(json => console.log(json))
      .catch(err => console.error('error:' + err));
  }
}
