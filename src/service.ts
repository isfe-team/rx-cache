/*!
 * a simple service use cache
 * @bqliu
 */

// import axios from 'axios';
import { from } from 'rxjs';
import { AsyncCache } from './cache';

type User = {
  id: number;
  name: string;
}

enum ResponseStatus {
  OK = 0,
  ERROR = 1
}

interface IResponse<T> {
  status: ResponseStatus;
  message: string;
  data: T;
}

type IUserResponse = IResponse<Array<User>>

const userRes: IUserResponse = {
  status: ResponseStatus.OK,
  message: '',
  data: [
    { id: 0, name: 'A' },
    { id: 1, name: 'B' }
  ]
};

const getUsersApi = (() => {
  let cnt = 0;
  return (...args: any[]) => {
    console.log('args', args);
    cnt += 1;
    if (cnt % 3 === 0) {
      return Promise.resolve(userRes);
    }
    return Promise.reject({ status: ResponseStatus.ERROR, message: 'error' });
  }
})();

export const user = {
  getUserCache(...args: any[]) {
    return new AsyncCache({
      retryCount: 2,
      replayCount: 2,
      observableGenerator: () => from(getUsersApi.apply(null, args))
    });
  }
}
