import { UtilsService } from './utils-service';

export class ApiService {

  constructor(private utils: UtilsService) { }

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
      const assetType = "USDT";
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
    return new Promise<any>(async (resolve, reject) => {
      const fetch = require('node-fetch');

      const url = 'http://api.hxro.io/hxroapi/api/Contests/by-series/' + seriesId;
      const options = { method: 'GET', headers: { Accept: 'text/plain' } };

      fetch(url, options)
        .then(res => res.json())
        .then(json => resolve(json))
        .catch(err => reject('error:' + err));
    });
  }



  async getActualPayout(token: string) {
    let $moonPayout = 1.91;
    let $rektPayout = 1.91;
    const seriesId = await this.getSeriesId(token);
    const contests = await this.getContestsBySeriesId(seriesId);

    contests.forEach(element => {
      if (element.status === 'Live') {
        $moonPayout = (element.rektPool / element.moonPool) + 1;
        $rektPayout = (element.moonPool / element.rektPool) + 1;
        if ($moonPayout == NaN || $rektPayout == NaN) {
          console.log('SeriesId', seriesId);
          console.log('Contests', contests, contests.length);
        }
      }
    });

    return {
      moonPayout: this.utils.round(this.utils.addFees($moonPayout) - 1, 2),
      rektPayout: this.utils.round(this.utils.addFees($rektPayout) - 1, 2)
    };

  }
}
