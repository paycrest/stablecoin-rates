import { Cron } from 'croner';
import { Source } from './sources';

type Sources = {
  source: Source<string>;
  pattern: string;
}[];

export class Currency {
  private _fiat: string;
  private _sources: Sources;

  constructor(fiat: string, sources: Sources) {
    this._fiat = fiat;
    this._sources = sources;

    for (const param of this._sources) {
      /**
       * Using croner instead of @nestjs/schedule
       * because of issue: https://github.com/kelektiv/node-cron/issues/805
       */
      new Cron(param.pattern, () => {
        param.source.fetchData(this._fiat);
      });
    }
  }
}
