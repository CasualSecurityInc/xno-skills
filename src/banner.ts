import { version } from './version.js';

const whiteFg=`\x1b[38;2;255;255;255m`
const greyFg=`\x1b[38;2;155;155;155m`
const blueFg=`\x1b[38;2;37;156;233m`
const marineBg=`\x1b[48;2;31;32;76m`
const reset=`\x1b[0m`
const logo=String.raw`MB[K
   __W/\\/\\\\\\B____W/\\\\\\\\\B_____W/\\/\\\\\\B_______W/\\\\\B____[K
    _W\/\\\G////W\\\B__W\G////////W\\\B___W\/\\\G////W\\\B____W/\\\G///W\\\B__[K
     _W\/\\\B__W\/G/W\\\B___W/\\\\\\\\\\B__W\/\\\B__W\/G/W\\\B__W/\\\B__W\/G/W\\B__[K
      _W\/\\\B___W\/\\\B__W/\\\G/////W\\\B__W\/\\\B___W\/\\\B_W\/G/W\\\B__W/\\\B__[K
       _W\/\\\B___W\/\\\B_W\//\\\\\\\/\B___W\/\\\B___W\/\\\B__W\/G//W\\\\/B____[K
        _W\/G//B____W\/G//B___W\/G///////W\/G/B__W\/G//B____W\/G//B_____W\/G////B_____[K
                                                  WMxno-skills v${version}[K
[K[0m

Interact with Nano (XNO / Ӿ)`
.replaceAll('W',whiteFg)
.replaceAll('G',greyFg)
.replaceAll('B',blueFg)
.replaceAll('M',marineBg)

function getAsciiArtBanner(): string {
  return logo;
}

export { getAsciiArtBanner };
