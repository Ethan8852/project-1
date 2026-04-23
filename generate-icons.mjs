import { deflateSync } from 'zlib';
import { writeFileSync } from 'fs';

function makePNG(size) {
  function crc32(buf) {
    const t = new Uint32Array(256);
    for (let i = 0; i < 256; i++) { let c = i; for (let j = 0; j < 8; j++) c = (c&1)?(0xEDB88320^(c>>>1)):(c>>>1); t[i]=c; }
    let crc = 0xFFFFFFFF;
    for (const b of buf) crc = t[(crc^b)&0xFF]^(crc>>>8);
    return (crc^0xFFFFFFFF)>>>0;
  }
  function chunk(type, data) {
    const l=Buffer.alloc(4); l.writeUInt32BE(data.length);
    const tp=Buffer.from(type), cc=Buffer.concat([tp,data]), cv=Buffer.alloc(4);
    cv.writeUInt32BE(crc32(cc)); return Buffer.concat([l,tp,data,cv]);
  }
  const ihdr=Buffer.alloc(13);
  ihdr.writeUInt32BE(size,0); ihdr.writeUInt32BE(size,4); ihdr[8]=8; ihdr[9]=2;
  const rows=[];
  for(let y=0;y<size;y++){
    const row=Buffer.alloc(1+size*3); row[0]=0;
    for(let x=0;x<size;x++){
      // 보라→핑크 그라데이션 + 모서리 라운딩
      const t=(x+y)/(size*2-2);
      const r2=Math.round(size*0.18);
      const dx=Math.min(x,size-1-x), dy=Math.min(y,size-1-y);
      const corner=dx<r2&&dy<r2&&Math.sqrt((r2-dx)**2+(r2-dy)**2)>r2;
      if(corner){ row[1+x*3]=0xF5; row[2+x*3]=0xF2; row[3+x*3]=0xFF; }
      else {
        row[1+x*3]=Math.round(0xCD+t*(0xFF-0xCD));
        row[2+x*3]=Math.round(0xB4+t*(0xAF-0xB4));
        row[3+x*3]=Math.round(0xDB+t*(0xCC-0xDB));
      }
    }
    rows.push(row);
  }
  const idat=chunk('IDAT',deflateSync(Buffer.concat(rows)));
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),idat,chunk('IEND',Buffer.alloc(0))]);
}

writeFileSync('icons/icon-192.png', makePNG(192));
writeFileSync('icons/icon-512.png', makePNG(512));
console.log('✅ icon-192.png, icon-512.png 생성 완료');
