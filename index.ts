/*!
 * simple test of cache
 * @bqliu
 */

import './main.css';
import { user } from './src/service';

user.getUserCache().cache$$.subscribe(
  (x) => console.log('x', x),
  (y) => console.log('y', y)
)
