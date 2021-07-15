import { promisify } from "util";
import firebase from "firebase";
import fs from "fs";
import { error } from "console";

export class UtilsService {
  constructor() {}

  /**
   * Parse et push les donnees CSV.
   */
  async getDataFromFile(): Promise<any> {
    const result = [];
    const content = await promisify(fs.readFile)(
      "src\\assets\\EURUSD60.csv",
      "UTF-8"
    );
    const csvToRowArray = content.split("\r\n");
    for (let index = 1; index < csvToRowArray.length - 1; index++) {
      const element = csvToRowArray[index].split("\t"); // d, o, h, l, c, v
      result.push({
        date: element[0],
        open: parseFloat(element[1]),
        high: parseFloat(element[2]),
        low: parseFloat(element[3]),
        close: parseFloat(element[4]),
        volume: parseFloat(element[5]),
      });
    }
    return result;
  }

  /**
   * Permet de retourner le R:R
   */
  getRiskReward(
    entryPrice: number,
    initialStopLoss: number,
    closedPrice: number
  ): number {
    const result = this.round(
      Math.abs(closedPrice - entryPrice) /
        Math.abs(entryPrice - initialStopLoss),
      2
    );
    if (isNaN(result)) {
      return -1;
    } else {
      return result;
    }
  }

  /**
   * Retourne la valeur maximale en fonction de la source et de lookback
   */
  highest(data: any, index: number, source: string, lookback: number): number {
    let max: number;

    for (let k = 0; k < lookback; k++) {
      if (k === 0) {
        max = data[index - k][source];
      }

      if (data[index - k][source] > max) {
        max = data[index - k][source];
      }
    }
    return max;
  }

  /**
   * Retourne la valeur minimale en fonction de la source et de lookback
   */
  lowest(data: any, index: number, source: string, lookback: number): number {
    let min: number;

    for (let k = 0; k < lookback; k++) {
      if (k === 0) {
        min = data[index - k][source];
      }

      if (data[index - k][source] < min) {
        min = data[index - k][source];
      }
    }
    return min;
  }

  /**
   * Arrondi un nombre avec une certaine précision.
   */
  round(value: number, precision: number): number {
    const multiplier = Math.pow(10, precision || 0);
    return Math.round(value * multiplier) / multiplier;
  }

  /**
   * Retourne l'équivalent HeikenAshi
   */
  setHeikenAshiData(source: any): any {
    const result = [];

    for (let j = 0; j < source.length; j++) {
      if (j === 0) {
        const _close = this.round(
          (source[j].open + source[j].high + source[j].low + source[j].close) /
            4,
          5
        );
        const _open = this.round((source[j].open + source[j].close) / 2, 5);
        result.push({
          close: _close,
          open: _open,
          low: source[j].low,
          high: source[j].high,
          bull: _close > _open,
          bear: _close < _open,
        });
      } else {
        const haCloseVar =
          (source[j].open + source[j].high + source[j].low + source[j].close) /
          4;
        const haOpenVar =
          (result[result.length - 1].open + result[result.length - 1].close) /
          2;
        result.push({
          close: this.round(haCloseVar, 5),
          open: this.round(haOpenVar, 5),
          low: this.round(
            Math.min(source[j].low, Math.max(haOpenVar, haCloseVar)),
            5
          ),
          high: this.round(
            Math.max(source[j].high, Math.max(haOpenVar, haCloseVar)),
            5
          ),
          bull: haCloseVar > haOpenVar,
          bear: haCloseVar < haOpenVar,
        });
      }
    }
    return result;
  }

  /**
   * Retourne une moving average en fonction de la période.
   */
  sma(data: any, index: number, periode: number): number {
    const result = [];
    const dataStart = index - periode;

    if (dataStart > 0) {
      for (let i = dataStart; i < index; i++) {
        result.push(data[i].close);
      }
      return this.round(result.reduce((a, b) => a + b, 0) / result.length, 5);
    } else {
      return 0;
    }
  }

  /**
   * Retourne le ticker timeframe.
   */
  getTickerTimeframe(string: string) {
    const str = string.split(".");
    const tf = str[4].split(":");
    return this.getTicker(string) + "_" + tf[1];
  }

  /**
   * Retourne le ticker.
   */
  getTicker(string: string) {
    const str = string.split(".");
    return str[2];
  }

  /**
   * Permet d'arrêter le processus.
   */
  stopProcess() {
    console.log("Process will be stopped !");
    process.exit();
  }

  /**
   * Retourne la date avec décalage horaire.
   */
  getDate(): any {
    let date = new Date();
    const year = date.getFullYear();
    const month = "0" + (date.getMonth() + 1);
    const day = "0" + date.getDate();
    const hours = "0" + date.getHours();
    const minutes = "0" + date.getMinutes();
    const second = "0" + date.getSeconds();
    return (
      day.substr(-2) +
      "/" +
      month.substr(-2) +
      "/" +
      year +
      " " +
      hours.substr(-2) +
      ":" +
      minutes.substr(-2) +
      ":" +
      second.substr(-2)
    );
  }

  /**
   * Retourne la date avec décalage horaire.
   */
  getSecondFromDate(): any {
    let date = new Date();
    const second = "0" + date.getSeconds();
    return second.substr(-2);
  }

  /**
   * Insert chaque trade dans Firebase.
   */
  insertTrade(
    tickerTfData: any,
    $tickerTf: string,
    $winTrades: any,
    $loseTrades: any,
    $allTrades: any
  ) {
    try {
      let $direction: string;
      let $entryTime: any;
      let $entryPrice: number;
      let $stopLoss: number;
      let $takeProfit: number;
      let time: number;

      if (tickerTfData.inLong) {
        $direction = "Long";
        $entryTime = tickerTfData.entryTime_Long;
        $entryPrice = tickerTfData.entryPrice_Long;
        $stopLoss = tickerTfData.initialStopLoss_Long;
        $takeProfit = tickerTfData.takeProfit_Long;
        time = tickerTfData.snapshot_Long.time;
      } else if (tickerTfData.inShort) {
        $direction = "Short";
        $entryTime = tickerTfData.entryTime_Short;
        $entryPrice = tickerTfData.entryPrice_Short;
        $stopLoss = tickerTfData.initialStopLoss_Short;
        $takeProfit = tickerTfData.takeProfit_Short;
        time = tickerTfData.snapshot_Short.time;
      } else {
        throw new error();
      }

      firebase
        .database()
        .ref("/trade")
        .push({
          direction: $direction,
          tickerTf: $tickerTf,
          setupTime: tickerTfData.ohlc[time].date,
          entryTime: $entryTime,
          exitTime: this.getDate(),
          entryPrice: $entryPrice,
          stopLoss: $stopLoss,
          takeProfit: $takeProfit,
          rr: this.getRiskReward($entryPrice, $stopLoss, $takeProfit),
        });

      const $avgRR = this.round(
        $allTrades.reduce((a, b) => a + b, 0) / $allTrades.length,
        2
      );
      const $winrate =
        this.round(
          ($winTrades.length / ($loseTrades.length + $winTrades.length)) * 100,
          2
        ) + "%";
      firebase.database().ref("/results").remove();
      firebase
        .database()
        .ref("/results")
        .push({
          winTrades: $winTrades.length,
          loseTrades: $loseTrades.length,
          totalTrades: $winTrades.length + $loseTrades.length,
          totalRR: this.round(
            $loseTrades.reduce((a, b) => a + b, 0) +
              $winTrades.reduce((a, b) => a + b, 0),
            2
          ),
          avgRR: $avgRR ? $avgRR : 0,
          winrate: $winrate ? $winrate : 0,
        });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Envoie une notification à Télégram.
   */
  sendTelegramMsg(telegramBotObject: any, chatId: string, msg: string) {
    try {
      telegramBotObject.sendMessage(chatId, msg);
    } catch (err) {
      console.log(
        "Something went wrong when trying to send a Telegram notification",
        err
      );
    }
  }

  /**
   * Supprime le token si existant et refresh la connection toute les 10h.
   */
  async login(ig: any) {
    const tokenContent = await promisify(fs.readFile)(
      "node_modules\\node-ig-api\\tokens.json",
      "UTF-8"
    );
    const tokenJson = JSON.parse(tokenContent);

    if (tokenJson && tokenJson.tokens_exp > 0) {
      //await ig.logout();
      //console.log('logout');
    }

    await ig.login(true);
    setInterval(async function () {
      await ig.login(true);
    }, 1000 * 60 * 60 * 10);
  }
}

export default new UtilsService();
