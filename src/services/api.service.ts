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

  getObSnapshot(isSpot: boolean) {
    return new Promise<any>(async (resolve, reject) => {
      const fetch = require('node-fetch');
      const options = { method: 'GET', headers: { Accept: 'text/plain' } };

      let url: string;
      if (isSpot) {
        url = 'https://api.binance.com/api/v3/depth?symbol=BTCUSDT&limit=5000'; //spot
      } else {
        url = ' https://fapi.binance.com/fapi/v1/depth?symbol=BTCUSDT&limit=1000'; //futurs
      } 

      fetch(url, options)
        .then(res => res.json())
        .then(json => resolve(json))
        .catch(err => reject('error:' + err));
    });
  }

}
