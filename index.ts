/*!
 * simple test of cache
 * @bqliu
 */

import './main.css';
import { user } from './src/service';

user.getUserCache(1, 2, 3, 4, 5).cache$$.subscribe(
  (x) => console.log('x', x),
  (y) => console.log('y', y)
)
