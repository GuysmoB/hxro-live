import { UtilsService } from './utils-service';

export class ApiService {

  constructor(private utils: UtilsService) { }

  getDataFromApi(url: string): Promise<any> {
    return new Promise<any>(async (resolve, reject) => {
      const axios = require('axios').default;
      const res = await axios.get(url);
      if (res) {
        resolve(res.data);
      } else {
        reject();
      }
    });
  }


  getSeriesId(token: string, ticker: string): Promise<any> {
    const contestDuration = '00:05:00';
    const assetType = 'HXRO';
    const apiToken = token;
    let contestPair: string;
    if (ticker === 'BNB') {
      contestPair = ticker + '/USDT';
    } else {
      contestPair = ticker + '/USD';
    }

    return new Promise<any>(async (resolve, reject) => {
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



  async getActualPayout(seriesId: any) {
    let $moonPayout: any;
    let $rektPayout: any;
    let $nextPrizePool = 0;
    let heroBet = 10;
    const contests = await this.getContestsBySeriesId(seriesId);

    for (let i = 0; i < contests.length; i++) {
      if (contests[i].status === 'Live') {
        $moonPayout = (contests[i].rektPool / (contests[i].moonPool + heroBet)) + 1;
        $rektPayout = (contests[i].moonPool / (contests[i].rektPool + heroBet)) + 1;
        $nextPrizePool = contests[i - 1].prizePool;
      }
    }

    if ($moonPayout == undefined || $rektPayout == undefined) {
      $moonPayout = $rektPayout = 1.91;
    }

    return {
      moonPayout: this.utils.round(this.utils.addFees($moonPayout) - 1, 2),
      rektPayout: this.utils.round(this.utils.addFees($rektPayout) - 1, 2),
      nextPrizePool: $nextPrizePool
    };
  }
}