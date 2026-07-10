import pptxgen from 'pptxgenjs';
import { readdirSync, existsSync } from 'fs';

const FRAMES = './pptx-frames';
const pptx = new pptxgen();
pptx.defineLayout({ name: 'WIDE', width: 13.333, height: 7.5 });
pptx.layout = 'WIDE';
pptx.author = 'Team Bar Raisers';
pptx.title = 'Alexa Thinks Ahead — HackOn with Amazon Season 6.0';

const files = readdirSync(FRAMES).filter((f) => f.endsWith('.png')).sort();
const DEMO_SLIDE_INDEX = 5; // slide-06 = the demo video slide

files.forEach((f, i) => {
  const slide = pptx.addSlide();
  slide.addImage({ path: `${FRAMES}/${f}`, x: 0, y: 0, w: 13.333, h: 7.5 });

  // If the demo video exists, embed it over the placeholder well on slide 6
  if (i === DEMO_SLIDE_INDEX && existsSync('/home/thequacker/hackon_project/hackon_project/deck/assets/demo.mp4')) {
    // video well in the frame: x=210/1600, y=220/900, w=1180/1600, h=664/900
    slide.addMedia({
      type: 'video',
      path: '/home/thequacker/hackon_project/hackon_project/deck/assets/demo.mp4',
      x: (210 / 1600) * 13.333, y: (220 / 900) * 7.5,
      w: (1180 / 1600) * 13.333, h: (664 / 900) * 7.5,
    });
    console.log('embedded demo.mp4 on slide', i + 1);
  }
});

await pptx.writeFile({ fileName: '/home/thequacker/hackon_project/hackon_project/deck/Alexa-Thinks-Ahead-Bar-Raisers.pptx' });
console.log('wrote pptx with', files.length, 'slides');
