import firebase from "firebase";
export class UtilsService {

  constructor() { }

  /**
   * Prend en compte les fees de Hxro
   */
  addFees(gain: number) {
    return gain - (gain * 0.03)
  }



  /**
   * Fait la somme des nombres d'un tableau
   */
  arraySum(array: any) {
    return array.reduce((a, b) => a + b, 0);
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
        const _close = this.round((source[j].open + source[j].high + source[j].low + source[j].close) / 4, 5);
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
        const haCloseVar = (source[j].open + source[j].high + source[j].low + source[j].close) / 4;
        const haOpenVar = (result[result.length - 1].open + result[result.length - 1].close) / 2;
        result.push({
          close: this.round(haCloseVar, 5),
          open: this.round(haOpenVar, 5),
          low: this.round(Math.min(source[j].low, Math.max(haOpenVar, haCloseVar)), 5),
          high: this.round(Math.max(source[j].high, Math.max(haOpenVar, haCloseVar)), 5),
          bull: haCloseVar > haOpenVar,
          bear: haCloseVar < haOpenVar,
        });
      }
    }
    return result;
  }


  /**
   * Permet d'arrêter le processus.
   */
  stopProcess(msg: string) {
    console.error(msg)
    process.exit(1);
  }

  /**
   * Retourne la date avec décalage horaire.
   */
  getDate(ts?: any): any {
    let date = ts ? new Date(ts) : new Date();
    const year = date.getFullYear();
    const month = "0" + (date.getMonth() + 1);
    const day = "0" + date.getDate();
    const hours = "0" + date.getHours();
    const minutes = "0" + date.getMinutes();
    const second = "0" + date.getSeconds();
    return (day.substr(-2) + "/" + month.substr(-2) + "/" + year + " " + hours.substr(-2) + ":" + minutes.substr(-2) + ":" + second.substr(-2));
  }

  /**
   * Check la validité des arguments passés à l'app.
   */
  checkArg(ticker: string, tf: string, allTicker: any, allTf: any) {
    if (!allTicker.includes(ticker) || !allTf.includes(tf)) {
      this.stopProcess('Argument error: ' + ticker + ' ' + tf);
    }
  }

  /**
   * Insert chaque trade dans Firebase.
   */
  async updateFirebaseResults($rr: any, databasePath: string) {
    try {
      const res = await this.getFirebaseResults(databasePath);
      if (res) {
        const $winTrades = ($rr > 0) ? res.winTrades + 1 : res.winTrades;
        const $loseTrades = ($rr < 0) ? res.loseTrades + 1 : res.loseTrades;
        const $winrate = this.round(($winTrades / ($loseTrades + $winTrades)) * 100, 2);
        await firebase.database().ref(databasePath).remove();
        await firebase.database().ref(databasePath).push({
          winTrades: $winTrades,
          loseTrades: $loseTrades,
          totalTrades: res.totalTrades + 1,
          totalRR: res.totalRR + $rr,
          'winrate%': $winrate ? $winrate : 0,
        });
      }
    } catch (error) {
      throw new Error('Error updateFirebaseResults()' + error);
    }
  }


  /**
   * Initialise Firebase si la rerf n'existe pas.
   */
  async initFirebase(databasePath: string) {
    try {
      const res = await this.getFirebaseResults(databasePath);
      if (!res) {
        await firebase.database().ref(databasePath).push({
          winTrades: 0,
          loseTrades: 0,
          totalTrades: 0,
          totalRR: 0,
          'winrate%': 0,
        });
      }
    } catch (error) {
      throw new Error('Error initFirebase()' + error);
    }
  }

  /**
   * Récupère les resultats depuis Firebase.
   */
  async getFirebaseResults(databasePath: string) {
    try {
      let snapshot = await firebase.database().ref(databasePath).once('value');
      if (snapshot.exists()) {
        const id = Object.keys(snapshot.val())[0];
        return snapshot.child(id).val();
      }
    } catch (error) {
      console.error(error);
    }
    return undefined;
  }

}

export default new UtilsService();
