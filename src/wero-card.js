var WERO_CARD_VERSION = '__VERSION__';

// ── QR Code engine (pure JS, Reed-Solomon, no CDN) ───────────────────────────
// biome-ignore lint: vendored/minified third-party code
var QRErrorCorrectLevel={L:1,M:0,Q:3,H:2};function QRCodeModel(a,b){this.typeNumber=a;this.errorCorrectLevel=b;this.modules=null;this.moduleCount=0;this.dataCache=null;this.dataList=[]}QRCodeModel.prototype={addData:function(a){this.dataList.push(new QR8bitByte(a));this.dataCache=null},isDark:function(a,b){if(a<0||this.moduleCount<=a||b<0||this.moduleCount<=b)throw new Error(a+","+b);return this.modules[a][b]},getModuleCount:function(){return this.moduleCount},make:function(){this.makeImpl(false,this.getBestMaskPattern())},makeImpl:function(a,b){this.moduleCount=this.typeNumber*4+17;this.modules=function(a){var b=new Array(a);for(var c=0;c<a;c++){b[c]=new Array(a);for(var d=0;d<a;d++)b[c][d]=null}return b}(this.moduleCount);this.setupPositionProbePattern(0,0);this.setupPositionProbePattern(this.moduleCount-7,0);this.setupPositionProbePattern(0,this.moduleCount-7);this.setupPositionAdjustPattern();this.setupTimingPattern();this.setupTypeInfo(a,b);if(this.typeNumber>=7)this.setupTypeNumber(a);if(this.dataCache==null)this.dataCache=QRCodeModel.createData(this.typeNumber,this.errorCorrectLevel,this.dataList);this.mapData(this.dataCache,b)},setupPositionProbePattern:function(a,b){for(var c=-1;c<=7;c++){if(a+c<=-1||this.moduleCount<=a+c)continue;for(var d=-1;d<=7;d++){if(b+d<=-1||this.moduleCount<=b+d)continue;if((0<=c&&c<=6&&(d==0||d==6))||(0<=d&&d<=6&&(c==0||c==6))||(2<=c&&c<=4&&2<=d&&d<=4))this.modules[a+c][b+d]=true;else this.modules[a+c][b+d]=false}}},getBestMaskPattern:function(){var a=0,b=0;for(var c=0;c<8;c++){this.makeImpl(true,c);var d=QRUtil.getLostPoint(this);if(c==0||a>d){a=d;b=c}}return b},setupTimingPattern:function(){for(var a=8;a<this.moduleCount-8;a++)if(this.modules[a][6]==null)this.modules[a][6]=(a%2==0);for(var b=8;b<this.moduleCount-8;b++)if(this.modules[6][b]==null)this.modules[6][b]=(b%2==0)},setupPositionAdjustPattern:function(){var a=QRUtil.getPatternPosition(this.typeNumber);for(var b=0;b<a.length;b++)for(var c=0;c<a.length;c++){var d=a[b],e=a[c];if(this.modules[d][e]!=null)continue;for(var f=-2;f<=2;f++)for(var g=-2;g<=2;g++)if(f==-2||f==2||g==-2||g==2||(f==0&&g==0))this.modules[d+f][e+g]=true;else this.modules[d+f][e+g]=false}},setupTypeNumber:function(a){var b=QRUtil.getBCHTypeNumber(this.typeNumber);for(var c=0;c<18;c++){var d=(!a&&((b>>c)&1)==1);this.modules[Math.floor(c/3)][c%3+this.moduleCount-8-3]=d}for(var c=0;c<18;c++){var d=(!a&&((b>>c)&1)==1);this.modules[c%3+this.moduleCount-8-3][Math.floor(c/3)]=d}},setupTypeInfo:function(a,b){var c=(this.errorCorrectLevel<<3)|b,d=QRUtil.getBCHTypeInfo(c);for(var e=0;e<15;e++){var f=(!a&&((d>>e)&1)==1);if(e<6)this.modules[e][8]=f;else if(e<8)this.modules[e+1][8]=f;else this.modules[this.moduleCount-15+e][8]=f}for(var e=0;e<15;e++){var f=(!a&&((d>>e)&1)==1);if(e<8)this.modules[8][this.moduleCount-e-1]=f;else if(e<9)this.modules[8][15-e-1+1]=f;else this.modules[8][15-e-1]=f}this.modules[this.moduleCount-8][8]=(!a)},mapData:function(a,b){var c=-1,d=this.moduleCount-1,e=7,f=0;for(var g=this.moduleCount-1;g>0;g-=2){if(g==6)g--;while(true){for(var h=0;h<2;h++){if(this.modules[d][g-h]==null){var i=false;if(f<a.length)i=(((a[f]>>>(e))&1)==1);var j=QRUtil.getMask(b,d,g-h);if(j)i=!i;this.modules[d][g-h]=i;e--;if(e==-1){f++;e=7}}}d+=c;if(d<0||this.moduleCount<=d){d-=c;c=-c;break}}}}};QRCodeModel.PAD0=0xEC;QRCodeModel.PAD1=0x11;QRCodeModel.createData=function(a,b,c){var d=QRRSBlock.getRSBlocks(a,b),e=new QRBitBuffer;for(var f=0;f<c.length;f++){var g=c[f];e.put(g.mode,4);e.put(g.getLength(),QRUtil.getLengthInBits(g.mode,a));g.write(e)}var h=0;for(var f=0;f<d.length;f++)h+=d[f].dataCount;if(e.getLengthInBits()>h*8)throw new Error("code length overflow. ("+e.getLengthInBits()+">"+h*8+")");if(e.getLengthInBits()+4<=h*8)e.put(0,4);while(e.getLengthInBits()%8!=0)e.putBit(false);while(true){if(e.getLengthInBits()>=h*8)break;e.put(QRCodeModel.PAD0,8);if(e.getLengthInBits()>=h*8)break;e.put(QRCodeModel.PAD1,8)}return QRCodeModel.createBytes(e,d)};QRCodeModel.createBytes=function(a,b){var c=0,d=0,e=0,f=new Array(b.length),g=new Array(b.length);for(var h=0;h<b.length;h++){var i=b[h].dataCount,j=b[h].totalCount-i;d=Math.max(d,i);e=Math.max(e,j);f[h]=new Array(i);for(var k=0;k<f[h].length;k++)f[h][k]=0xff&a.buffer[k+c];c+=i;var l=QRUtil.getErrorCorrectPolynomial(j),m=new QRPolynomial(f[h],l.getLength()-1),n=m.mod(l);g[h]=new Array(l.getLength()-1);for(var k=0;k<g[h].length;k++){var o=k+n.getLength()-g[h].length;g[h][k]=(o>=0)?n.get(o):0}}var p=0;for(var h=0;h<b.length;h++)p+=b[h].totalCount;var q=new Array(p),r=0;for(var k=0;k<d;k++)for(var h=0;h<b.length;h++)if(k<f[h].length)q[r++]=f[h][k];for(var k=0;k<e;k++)for(var h=0;h<b.length;h++)if(k<g[h].length)q[r++]=g[h][k];return q};var QRUtil={PATTERN_POSITION_TABLE:[[],[6,18],[6,22],[6,26],[6,30],[6,34],[6,22,38],[6,24,42],[6,26,46],[6,28,50],[6,30,54],[6,32,58],[6,34,62],[6,26,46,66],[6,26,48,70],[6,26,50,74],[6,30,54,78],[6,30,56,82],[6,30,58,86],[6,34,62,90],[6,28,50,72,94],[6,26,50,74,98],[6,30,54,78,102],[6,28,54,80,106],[6,32,58,84,110],[6,30,58,86,114],[6,34,62,90,118],[6,26,50,74,98,122],[6,30,54,78,102,126],[6,26,52,78,104,130],[6,30,56,82,108,134],[6,34,60,86,112,138],[6,30,58,86,114,142],[6,34,62,90,118,146],[6,30,54,78,102,126,150],[6,24,50,76,102,128,154],[6,28,54,80,106,132,158],[6,32,58,84,110,136,162],[6,26,54,82,110,138,166],[6,30,58,86,114,142,170]],getBCHTypeInfo:function(a){var b=a<<10;while(QRUtil.getBCHDigit(b)-QRUtil.getBCHDigit(1335)>=0)b^=(1335<<(QRUtil.getBCHDigit(b)-QRUtil.getBCHDigit(1335)));return((a<<10)|b)^21522},getBCHTypeNumber:function(a){var b=a<<12;while(QRUtil.getBCHDigit(b)-QRUtil.getBCHDigit(7973)>=0)b^=(7973<<(QRUtil.getBCHDigit(b)-QRUtil.getBCHDigit(7973)));return(a<<12)|b},getBCHDigit:function(a){var b=0;while(a!=0){b++;a>>>=1}return b},getPatternPosition:function(a){return QRUtil.PATTERN_POSITION_TABLE[a-1]},getMask:function(a,b,c){switch(a){case 0:return(b+c)%2==0;case 1:return b%2==0;case 2:return c%3==0;case 3:return(b+c)%3==0;case 4:return(Math.floor(b/2)+Math.floor(c/3))%2==0;case 5:return(b*c)%2+(b*c)%3==0;case 6:return((b*c)%2+(b*c)%3)%2==0;case 7:return((b*c)%3+(b+c)%2)%2==0}},getErrorCorrectPolynomial:function(a){var b=new QRPolynomial([1],0);for(var c=0;c<a;c++)b=b.multiply(new QRPolynomial([1,QRMath.gexp(c)],0));return b},getLengthInBits:function(a,b){if(1<=b&&b<10){if(a==1)return 10;if(a==2)return 9;if(a==4)return 8;if(a==8)return 8;throw new Error("mode:"+a)}else if(b<27){if(a==1)return 12;if(a==2)return 11;if(a==4)return 16;if(a==8)return 10;throw new Error("mode:"+a)}else{if(a==1)return 14;if(a==2)return 13;if(a==4)return 16;if(a==8)return 12;throw new Error("mode:"+a)}},getLostPoint:function(a){var b=a.getModuleCount(),c=0;for(var d=0;d<b;d++){for(var e=0;e<b;e++){var f=0,g=a.isDark(d,e);for(var h=-1;h<=1;h++){if(d+h<0||b<=d+h)continue;for(var i=-1;i<=1;i++){if(e+i<0||b<=e+i)continue;if(h==0&&i==0)continue;if(g==a.isDark(d+h,e+i))f++}}if(f>5)c+=(3+f-5)}}for(var d=0;d<b-1;d++){for(var e=0;e<b-1;e++){var j=0;if(a.isDark(d,e))j++;if(a.isDark(d+1,e))j++;if(a.isDark(d,e+1))j++;if(a.isDark(d+1,e+1))j++;if(j==0||j==4)c+=3}}for(var d=0;d<b;d++){for(var e=0;e<b-6;e++){if(a.isDark(d,e)&&!a.isDark(d,e+1)&&a.isDark(d,e+2)&&a.isDark(d,e+3)&&a.isDark(d,e+4)&&!a.isDark(d,e+5)&&a.isDark(d,e+6))c+=40}}for(var e=0;e<b;e++){for(var d=0;d<b-6;d++){if(a.isDark(d,e)&&!a.isDark(d+1,e)&&a.isDark(d+2,e)&&a.isDark(d+3,e)&&a.isDark(d+4,e)&&!a.isDark(d+5,e)&&a.isDark(d+6,e))c+=40}}var k=0;for(var e=0;e<b;e++)for(var d=0;d<b;d++)if(a.isDark(d,e))k++;var l=Math.abs(100*k/b/b-50)/5;c+=l*10;return c}};var QRMath={gexp:function(a){while(a<0)a+=255;while(a>=256)a-=255;return QRMath.EXP_TABLE[a]},glog:function(a){if(a<1)throw new Error("glog("+a+")");return QRMath.LOG_TABLE[a]},EXP_TABLE:new Array(256),LOG_TABLE:new Array(256)};for(var i=0;i<8;i++)QRMath.EXP_TABLE[i]=1<<i;for(var i=8;i<256;i++)QRMath.EXP_TABLE[i]=QRMath.EXP_TABLE[i-4]^QRMath.EXP_TABLE[i-5]^QRMath.EXP_TABLE[i-6]^QRMath.EXP_TABLE[i-8];for(var i=0;i<255;i++)QRMath.LOG_TABLE[QRMath.EXP_TABLE[i]]=i;function QRPolynomial(a,b){if(a.length==undefined)throw new Error(a.length+"/"+b);var c=0;while(c<a.length&&a[c]==0)c++;this.num=new Array(a.length-c+b);for(var d=0;d<a.length-c;d++)this.num[d]=a[d+c]}QRPolynomial.prototype={get:function(a){return this.num[a]},getLength:function(){return this.num.length},multiply:function(a){var b=new Array(this.getLength()+a.getLength()-1);for(var c=0;c<b.length;c++)b[c]=0;for(var c=0;c<this.getLength();c++)for(var d=0;d<a.getLength();d++)b[c+d]^=QRMath.gexp(QRMath.glog(this.get(c))+QRMath.glog(a.get(d)));return new QRPolynomial(b,0)},mod:function(a){if(this.getLength()-a.getLength()<0)return this;var b=QRMath.glog(this.get(0))-QRMath.glog(a.get(0));var c=new Array(this.getLength());for(var d=0;d<this.getLength();d++)c[d]=this.get(d);for(var d=0;d<a.getLength();d++)c[d]^=QRMath.gexp(QRMath.glog(a.get(d))+b);return new QRPolynomial(c,0).mod(a)}};function QRRSBlock(a,b){this.totalCount=a;this.dataCount=b}QRRSBlock.RS_BLOCK_TABLE=[[1,26,19],[1,26,16],[1,26,13],[1,26,9],[1,44,34],[1,44,28],[1,44,22],[1,44,16],[1,70,55],[1,70,44],[2,35,17],[2,35,13],[1,100,80],[2,50,32],[2,50,24],[4,25,9],[1,134,108],[2,67,43],[2,33,15,2,34,16],[2,33,11,2,34,12],[2,86,68],[4,43,27],[4,43,19],[4,43,15],[2,98,78],[4,49,31],[2,32,14,4,33,15],[4,39,13,1,40,14],[2,121,97],[2,60,38,2,61,39],[4,40,18,2,41,19],[4,40,14,2,41,15],[2,146,116],[3,58,36,2,59,37],[4,36,16,4,37,17],[4,36,12,4,37,13],[2,86,68,2,87,69],[4,69,43,1,70,44],[6,43,19,2,44,20],[6,43,15,2,44,16],[4,101,81],[1,80,50,4,81,51],[4,50,22,4,51,23],[3,36,12,8,37,13],[2,116,92,2,117,93],[6,58,36,2,59,37],[4,46,20,6,47,21],[7,42,14,4,43,15],[4,133,107],[8,59,37,1,60,38],[8,44,20,4,45,21],[12,33,11,4,34,12],[3,145,115,1,146,116],[4,64,40,5,65,41],[11,36,16,5,37,17],[11,36,12,5,37,13],[5,109,87,1,110,88],[5,65,41,5,66,42],[5,54,24,7,55,25],[11,36,12,7,37,13],[5,122,98,1,123,99],[7,73,45,3,74,46],[15,43,19,2,44,20],[3,45,15,13,46,16],[1,135,107,5,136,108],[10,74,46,1,75,47],[1,50,22,15,51,23],[2,42,14,17,43,15],[5,150,120,1,151,121],[9,69,43,4,70,44],[17,50,22,1,51,23],[2,42,14,19,43,15],[3,141,113,4,142,114],[3,70,44,11,71,45],[17,47,21,4,48,22],[9,39,13,16,40,14],[3,135,107,5,136,108],[3,67,41,13,68,42],[15,54,24,5,55,25],[15,43,15,10,44,16],[4,144,116,4,145,117],[17,68,42],[17,50,22,6,51,23],[19,46,16,6,47,17],[2,139,111,7,140,112],[17,74,46],[7,54,24,16,55,25],[34,37,13],[4,151,121,5,152,122],[4,75,47,14,76,48],[11,54,24,14,55,25],[16,45,15,14,46,16],[6,147,117,4,148,118],[6,73,45,14,74,46],[11,54,24,16,55,25],[30,46,16,2,47,17],[8,132,106,4,133,107],[8,75,47,13,76,48],[7,54,24,22,55,25],[22,45,15,13,46,16],[10,142,114,2,143,115],[19,74,46,4,75,47],[28,50,22,6,51,23],[33,46,16,4,47,17],[8,152,122,4,153,123],[22,73,45,3,74,46],[8,53,23,26,54,24],[12,45,15,28,46,16],[3,147,117,10,148,118],[3,73,45,23,74,46],[4,54,24,31,55,25],[11,45,15,31,46,16],[7,146,116,7,147,117],[21,73,45,7,74,46],[1,53,23,37,54,24],[19,45,15,26,46,16],[5,145,115,10,146,116],[19,75,47,10,76,48],[15,54,24,25,55,25],[23,45,15,25,46,16],[13,145,115,3,146,116],[2,74,46,29,75,47],[42,54,24,1,55,25],[23,45,15,28,46,16],[17,145,115],[10,74,46,23,75,47],[10,54,24,35,55,25],[19,45,15,35,46,16],[17,145,115,1,146,116],[14,74,46,21,75,47],[29,54,24,19,55,25],[11,45,15,46,46,16],[13,145,115,6,146,116],[14,74,46,23,75,47],[44,54,24,7,55,25],[59,46,16,1,47,17],[12,151,121,7,152,122],[12,75,47,26,76,48],[39,54,24,14,55,25],[22,45,15,41,46,16],[6,151,121,14,152,122],[6,75,47,34,76,48],[46,54,24,10,55,25],[2,45,15,64,46,16],[17,152,122,4,153,123],[29,74,46,14,75,47],[49,54,24,10,55,25],[24,45,15,46,46,16],[4,152,122,18,153,123],[13,74,46,32,75,47],[48,54,24,14,55,25],[42,45,15,32,46,16],[20,147,117,4,148,118],[40,75,47,7,76,48],[43,54,24,22,55,25],[10,45,15,67,46,16],[19,148,118,6,149,119],[18,75,47,31,76,48],[34,54,24,34,55,25],[20,45,15,61,46,16]];QRRSBlock.getRSBlocks=function(a,b){var c=QRRSBlock.getRsBlockTable(a,b);if(c==undefined)throw new Error("bad rs block @ typeNumber:"+a+"/errorCorrectLevel:"+b);var d=c.length/3,e=[];for(var f=0;f<d;f++){var g=c[f*3+0],h=c[f*3+1],i=c[f*3+2];for(var j=0;j<g;j++)e.push(new QRRSBlock(h,i))}return e};QRRSBlock.getRsBlockTable=function(a,b){switch(b){case 1:return QRRSBlock.RS_BLOCK_TABLE[(a-1)*4+0];case 0:return QRRSBlock.RS_BLOCK_TABLE[(a-1)*4+1];case 3:return QRRSBlock.RS_BLOCK_TABLE[(a-1)*4+2];case 2:return QRRSBlock.RS_BLOCK_TABLE[(a-1)*4+3]}};function QRBitBuffer(){this.buffer=[];this.length=0}QRBitBuffer.prototype={get:function(a){var b=Math.floor(a/8);return((this.buffer[b]>>>(7-a%8))&1)==1},put:function(a,b){for(var c=0;c<b;c++)this.putBit(((a>>>(b-c-1))&1)==1)},getLengthInBits:function(){return this.length},putBit:function(a){var b=Math.floor(this.length/8);if(this.buffer.length<=b)this.buffer.push(0);if(a)this.buffer[b]|=(0x80>>>(this.length%8));this.length++}};function QR8bitByte(a){this.mode=4;this.data=a}QR8bitByte.prototype={getLength:function(){return unescape(encodeURIComponent(this.data)).length},write:function(a){var b=unescape(encodeURIComponent(this.data));for(var c=0;c<b.length;c++)a.put(b.charCodeAt(c),8)}};

// ── Wero logo (trademark of EPI Company, embedded as a data URI) ─────────────
var WERO_LOGO = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHhtbG5zOnhsaW5rPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rIiB2aWV3Qm94PSIwIDAgMTA4IDM2IiB3aWR0aD0iMTA4IiBoZWlnaHQ9IjM2Ij48ZGVmcz48bGluZWFyR3JhZGllbnQgaWQ9IndnMSIgeDE9Ijg3LjU1IiB4Mj0iODIuMzEiIHkxPSIxNS40NSIgeTI9IjIxLjg2IiBncmFkaWVudFRyYW5zZm9ybT0idHJhbnNsYXRlKDAgMjQpIiBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHN0b3Agb2Zmc2V0PSIuMDIiIHN0b3AtY29sb3I9IiMxZDFjMWMiIHN0b3Atb3BhY2l0eT0iMCIvPjxzdG9wIG9mZnNldD0iLjY4IiBzdG9wLWNvbG9yPSIjMWQxYzFjIi8+PC9saW5lYXJHcmFkaWVudD48bGluZWFyR3JhZGllbnQgeGxpbms6aHJlZj0iI3dnMSIgaWQ9IndnMiIgeDE9Ijc4LjQxIiB4Mj0iODMuNzgiIHkxPSIxNi44MSIgeTI9IjExLjUiLz48L2RlZnM+PHJlY3Qgd2lkdGg9IjEwOCIgaGVpZ2h0PSIzNiIgcng9IjgiIGZpbGw9IiNmZmY0OGQiLz48ZyB0cmFuc2Zvcm09InRyYW5zbGF0ZSgtNi4xNiAtMjIuMjQpIj48cGF0aCBmaWxsPSIjMWQxYzFjIiBkPSJNODMuMDMyIDQwLjI0YzAtNS43NTMgNC4wODktMTEuMDA3IDExLjE3NC0xMS4wMDdzMTEuMjExIDUuMjU0IDExLjIxMSAxMS4wMDgtNC4wODggMTEuMDA3LTExLjIxIDExLjAwNy0xMS4xNzUtNS4yNTQtMTEuMTc1LTExLjAwN20xNi4xNyAwYzAtMi43NzUtMS44MzItNS4zMjgtNC45NzctNS4zMjhzLTQuOTc3IDIuNTcxLTQuOTc3IDUuMzI4IDEuODY5IDUuMzQ2IDQuOTc3IDUuMzQ2IDQuOTc2LTIuNTcxIDQuOTc2LTUuMzQ2bS0yMC41MTYgNC4wODhjMi4zNS0xLjM1IDMuNzc0LTMuOTAzIDMuNzc0LTYuNzM0IDAtNC4yLTMuMDM0LTcuNzg4LTcuNzUyLTcuNzg4SDY0LjgxdjIwLjg4Nmg2LjE0MnYtNS4zMjhoMS4xNDdsMy41MTUgNS4zMjhoNy4yMTVsLTQuMTI2LTYuMzQ1Wm0tNS4yMTctMy43OTJoLTIuNTM1di01LjkwMmgyLjU3MmMxLjY0NiAwIDIuNzIgMS4zNSAyLjcyIDIuOTZzLTEuMDkyIDIuOTYtMi43MzkgMi45NlpNMzYuODAxIDI5Ljc3bC0zLjY4MiAxMi40NS0zLjU4OS0xMi40NWgtNC44ODRMMjEuMDIgNDIuMjJsLTMuNjQ0LTEyLjQ1aC02LjQ3NWw3LjQxOCAyMC44NDloNS4zMjhsMy40NDEtMTEuMzQgMy40MDQgMTEuMzRoNS4zNDdsNy40MTgtMjAuODVoLTYuNDc1Wm0xNS43NjIgMTUuNzYyYy0yLjI5NCAwLTMuOTA0LTEuMzg4LTQuNTg4LTMuMjJoMTUuNTc3Yy4xMy0uNjg0LjE4NS0xLjM4Ny4xODUtMi4xMDggMC01LjczNS00LjA4OS0xMC45OS0xMS4xNzQtMTAuOTl2NS42NjJjMi4zMTIgMCAzLjkwMyAxLjM4NyA0LjU4OCAzLjIxOUg0MS41OTJjLS4xMjkuNjg0LS4xODUgMS4zODctLjE4NSAyLjEwOSAwIDUuNzUzIDQuMDg5IDEwLjk4OSAxMS4xNTYgMTAuOTg5eiIvPjxwYXRoIGZpbGw9InVybCgjd2cxKSIgZD0iTTgzLjM3IDQ2LjA0aC4zOGMuNzctLjA0IDEuNDgtLjIgMi4xMS0uNDVzMS4xOC0uNiAxLjY1LTEuMDNjLjQ3LS40Mi44Ni0uOTIgMS4xNi0xLjQ3LjI3LS41LjQ3LTEuMDQuNi0xLjZoLTMuNTFjLS4wNy4xNS0uMTYuMjktLjI1LjQzLS4xMy4xOC0uMjguMzUtLjQ2LjQ5YTIuNDYgMi40NiAwIDAgMS0xLjI4LjU1Yy0uMTIuMDItLjI1LjAzLS4zOC4wMy0uNzkgMC0xLjQzLS4zLTEuODktLjc4bC0yLjI4IDIuMzFjMS4wMS45NCAyLjQyIDEuNTMgNC4xNyAxLjUzWiIgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoLTEwMS42OSAtMzQpc2NhbGUoMS44NSkiLz48cGF0aCBmaWxsPSJ1cmwoI3dnMikiIGQ9Ik04My4zNyAzNC4xN2MtMy4yNCAwLTUuMzIgMi4wNC01Ljg4IDQuNTVoMy41Yy40Mi0uODcgMS4yNC0xLjQ5IDIuMzgtMS40OS45MSAwIDEuNjEuMzkgMi4wNy45OGwyLjMtMi4zM2MtMS4wMy0xLjA0LTIuNTEtMS43MS00LjM3LTEuNzEiIHRyYW5zZm9ybT0idHJhbnNsYXRlKC0xMDEuNjkgLTM0KXNjYWxlKDEuODUpIi8+PC9nPjwvc3ZnPg==';

// ── i18n ──────────────────────────────────────────────────────────────────────
var WeroI18n = {
  fr: {
    default_title: 'Envoyer de l\'argent',
    payee: 'Bénéficiaire',
    hint: 'Scannez le QR code avec votre application bancaire',
    copy: 'Copier le lien',
    zoom: 'Agrandir le QR code',
    ed_url: 'Lien Wero (https://…)',
    ed_url_help: 'Le lien encodé dans votre QR code Wero',
    ed_title: 'Titre',
    ed_name: 'Nom du bénéficiaire',
    ed_logo: 'Afficher le logo Wero',
    ed_qr_size: 'Taille du QR code (px)',
    ed_language: 'Langue',
  },
  en: {
    default_title: 'Send money',
    payee: 'Payee',
    hint: 'Scan the QR code with your banking app',
    copy: 'Copy link',
    zoom: 'Enlarge QR code',
    ed_url: 'Wero link (https://…)',
    ed_url_help: 'The link encoded in your Wero QR code',
    ed_title: 'Title',
    ed_name: 'Payee name',
    ed_logo: 'Show the Wero logo',
    ed_qr_size: 'QR code size (px)',
    ed_language: 'Language',
  },
};

// Default displayed size of the QR code, in px (quiet zone included)
var WERO_QR_SIZE = 176;

function weroEsc(s) {
  return String(s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

// ── wero-card ─────────────────────────────────────────────────────────────────
class WeroCard extends HTMLElement {
  static getConfigElement() {
    return document.createElement('wero-card-editor');
  }

  static getStubConfig() {
    return { url: 'https://share.weropay.eu/p/1/c/XXXXXXXXXX' };
  }

  setConfig(config) {
    var url = config && typeof config.url === 'string' ? config.url.trim() : '';
    if (!/^https:\/\/\S+$/.test(url)) {
      throw new Error('url is required: the https link encoded in your Wero QR code');
    }
    this._configRaw = Object.assign({}, config, { url: url });
    if (!this.shadowRoot) this.attachShadow({ mode: 'open' });
    this._applyConfig();
  }

  set hass(hass) {
    var prevLang = this._hassLang;
    this._hassLang = hass?.language ? hass.language : null;
    if (this._configRaw && prevLang !== this._hassLang) this._applyConfig();
  }

  _getLang() {
    var lang = (this._configRaw?.language) || this._hassLang || document.documentElement.lang || 'en';
    return String(lang).split('-')[0];
  }

  _t(key) {
    var strings = WeroI18n[this._getLang()] || WeroI18n.en;
    return strings[key] || WeroI18n.en[key] || key;
  }

  _applyConfig() {
    var config = this._configRaw;
    this._config = {
      url: config.url,
      name: config.name || '',
      title: config.title || this._t('default_title'),
      logo: config.logo !== false,
      // Displayed size in px; unset or not a positive number keeps the default
      // 176 px from the stylesheet
      qr_size: Number(config.qr_size) > 0 ? Number(config.qr_size) : null,
    };
    this._render();
  }

  _buildQrSvg(text, size) {
    // Smallest version whose data capacity (RS block table) fits the byte-mode
    // payload: 4 mode bits + the length field + the payload itself
    var bytes = new QR8bitByte(text).getLength();
    var type = 0;
    for (var t = 1; t <= 40 && !type; t++) {
      var blocks = QRRSBlock.getRSBlocks(t, QRErrorCorrectLevel.M);
      var capacity = 0;
      for (var b = 0; b < blocks.length; b++) capacity += blocks[b].dataCount;
      if (4 + QRUtil.getLengthInBits(4, t) + bytes * 8 <= capacity * 8) type = t;
    }
    if (!type) throw new Error('url is too long for a QR code');
    var qr = new QRCodeModel(type, QRErrorCorrectLevel.M);
    qr.addData(text);
    qr.make();
    var n = qr.getModuleCount();
    var quiet = 4; // quiet zone required by the QR spec, in modules
    var dim = n + quiet * 2;
    var d = '';
    for (var r = 0; r < n; r++) {
      for (var c = 0; c < n; c++) {
        if (qr.isDark(r, c)) d += `M${c + quiet} ${r + quiet}h1v1h-1z`;
      }
    }
    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + size + '" height="' + size +
      '" viewBox="0 0 ' + dim + ' ' + dim + '" shape-rendering="crispEdges" role="img" aria-label="QR code">' +
      '<rect width="' + dim + '" height="' + dim + '" fill="#fff48d"/><path fill="#1d1c1c" d="' + d + '"/></svg>';
  }

  _copy() {
    var url = this._config.url;
    // Looked up when used: the card may re-render (language change) while the clipboard call runs
    var setIcon = (icon) => this.shadowRoot.getElementById('ico')?.setAttribute('icon', icon);
    var done = () => {
      setIcon('mdi:check');
      clearTimeout(this._copyTimer);
      this._copyTimer = setTimeout(() => setIcon('mdi:content-copy'), 1500);
    };
    var legacy = () => {
      var ta = document.createElement('textarea');
      ta.value = url;
      ta.style.cssText = 'position:fixed;opacity:0';
      document.body.appendChild(ta);
      ta.select();
      try { if (document.execCommand('copy')) done(); } catch (_e) { /* clipboard unavailable */ }
      ta.remove();
    };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(url).then(done, legacy);
    else legacy();
  }

  _render() {
    var c = this._config;
    var svg = this._buildQrSvg(c.url, c.qr_size || WERO_QR_SIZE);
    // A configured size overrides the 176 px of the stylesheet (it still shrinks to fit the card)
    var qrStyle = c.qr_size ? ` style="--wero-qr-size:${c.qr_size}px"` : '';
    var copy = weroEsc(this._t('copy'));
    var zoom = weroEsc(this._t('zoom'));
    // A re-render (e.g. language change via `set hass`) replaces an open zoom
    // dialog: close it cleanly first and reopen the new one afterwards
    var prevDlg = this.shadowRoot.getElementById('zoom');
    var wasOpen = !!(prevDlg && prevDlg.open);
    if (wasOpen) prevDlg.close();

    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; height: 100%; }
        ha-card { height: 100%; box-sizing: border-box; padding: 12px; display: flex; flex-direction: column; align-items: center; justify-content: flex-start; gap: 10px; }
        .header { display: flex; align-items: center; gap: 10px; width: 100%; margin-bottom: -2px; }
        /* The Wero wordmark on a 40 px tile of its own yellow, 2 px from the tile edges */
        .logo { width: 40px; height: 40px; box-sizing: border-box; padding: 0 2px; border-radius: 10px; background: #fff48d;
                display: block; flex: none; object-fit: contain; }
        .badge { width: 40px; height: 40px; border-radius: 50%; display: grid; place-items: center; flex: none;
                 --c: var(--primary-color, #03a9f4); background: color-mix(in srgb, var(--c) 16%, transparent); color: var(--c); }
        .badge ha-icon { color: inherit; --mdc-icon-size: 24px; }
        .name { flex: 1; min-width: 0; font-size: 16px; font-weight: 500; line-height: 1.25; color: var(--primary-text-color); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        ha-icon { color: var(--secondary-text-color); --mdc-icon-size: 22px; }
        button { background: none; border: none; cursor: pointer; padding: 0; display: flex; align-items: center; }
        .qr-wrap { background: #fff48d; border-radius: 10px; overflow: hidden; line-height: 0; max-width: 100%; cursor: zoom-in; }
        .qr-wrap svg { max-width: 100%; height: auto; width: var(--wero-qr-size, 176px); }
        dialog { border: none; padding: 0; margin: auto; background: #fff48d; border-radius: 12px; line-height: 0; overflow: hidden; cursor: zoom-out; }
        dialog::backdrop { background: rgba(0,0,0,0.85); }
        dialog svg { width: min(90vw, 90vh); height: auto; display: block; }
        .info-row { width: 100%; box-sizing: border-box; background: var(--secondary-background-color, rgba(127,127,127,.08)); border-radius: 10px; padding: 6px 10px; }
        .lbl { font-size: 11px; color: var(--secondary-text-color); margin-bottom: 0; }
        .val { font-size: 13px; font-weight: 500; word-break: break-word; color: var(--primary-text-color); }
        .hint { font-size: 11px; color: var(--secondary-text-color); text-align: center; }
      </style>
      <ha-card>
        <div class="header">
          ${c.logo ? `<img class="logo" src="${WERO_LOGO}" alt="Wero">` : '<div class="badge"><ha-icon icon="mdi:qrcode-scan"></ha-icon></div>'}
          <span class="name">${weroEsc(c.title)}</span>
          <button id="copy" title="${copy}" aria-label="${copy}"><ha-icon icon="mdi:content-copy" id="ico"></ha-icon></button>
        </div>
        <div class="qr-wrap" id="qr" role="button" tabindex="0" title="${zoom}" aria-label="${zoom}"${qrStyle}>${svg}</div>
        <dialog id="zoom" aria-label="${zoom}"></dialog>
        ${c.name ? `<div class="info-row"><div class="lbl">${weroEsc(this._t('payee'))}</div><div class="val">${weroEsc(c.name)}</div></div>` : ''}
        <div class="hint">${weroEsc(this._t('hint'))}</div>
      </ha-card>`;

    this.shadowRoot.getElementById('copy').onclick = () => this._copy();
    var qr = this.shadowRoot.getElementById('qr');
    var dlg = this.shadowRoot.getElementById('zoom');
    var open = () => {
      // The dialog gets its copy of the QR (a clone, the SVG path can be big) on first open only
      if (!dlg.firstChild) dlg.appendChild(qr.firstElementChild.cloneNode(true));
      if (!dlg.open) dlg.showModal();
    };
    qr.onclick = open;
    qr.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } };
    // Escape is handled natively by <dialog>; a click anywhere (QR or backdrop) closes it
    dlg.onclick = () => dlg.close();
    if (wasOpen) open();
  }

  disconnectedCallback() {
    // The timer that restores the copy icon is cancelled: restore it now
    clearTimeout(this._copyTimer);
    this.shadowRoot?.getElementById('ico')?.setAttribute('icon', 'mdi:content-copy');
  }

  getCardSize() { return 5; }

  getGridOptions() { return { columns: 6, min_columns: 4, rows: 'auto' }; }
}

// ── wero-card-editor (visual editor, built on HA's own ha-form) ──────────────
var WERO_EDITOR_SCHEMA = [
  { name: 'url', required: true, selector: { text: { type: 'url' } } },
  { name: 'title', selector: { text: {} } },
  { name: 'name', selector: { text: {} } },
  { name: 'logo', selector: { boolean: {} } },
  { name: 'qr_size', selector: { number: { min: 100, max: 600, step: 10, mode: 'slider', unit_of_measurement: 'px' } } },
  { name: 'language', selector: { select: { mode: 'dropdown', options: [
    { value: 'fr', label: 'Français' },
    { value: 'en', label: 'English' },
  ] } } },
];

class WeroCardEditor extends HTMLElement {
  setConfig(config) {
    this._config = Object.assign({}, config);
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    if (this._form) this._form.hass = hass;
  }

  _t(key) {
    var lang = String((this._hass?.language) || 'en').split('-')[0];
    var strings = WeroI18n[lang] || WeroI18n.en;
    return strings[key] || WeroI18n.en[key] || key;
  }

  async _render() {
    if (!this._form) {
      // ha-form is lazy-loaded by HA; loading a built-in card's editor guarantees it is defined.
      if (!customElements.get('ha-form')) {
        var entities = customElements.get('hui-entities-card');
        if (entities?.getConfigElement) await entities.getConfigElement();
      }
      this._form = document.createElement('ha-form');
      this._form.schema = WERO_EDITOR_SCHEMA;
      this._form.computeLabel = (s) => this._t(`ed_${s.name}`);
      this._form.computeHelper = (s) => (s.name === 'url' ? this._t('ed_url_help') : undefined);
      this._form.addEventListener('value-changed', (ev) => this._valueChanged(ev));
      this.appendChild(this._form);
    }
    this._form.hass = this._hass;
    this._form.data = Object.assign({ logo: true, qr_size: WERO_QR_SIZE }, this._config);
  }

  _valueChanged(ev) {
    var config = Object.assign({}, this._config, ev.detail.value);
    // Keep the YAML tidy: drop empty fields and values equal to their default.
    Object.keys(config).forEach((k) => {
      if (config[k] === '' || config[k] === null || config[k] === undefined) delete config[k];
    });
    if (config.logo === true) delete config.logo;
    if (Number(config.qr_size) === WERO_QR_SIZE) delete config.qr_size;
    this._config = config;
    this.dispatchEvent(new CustomEvent('config-changed', { detail: { config: config }, bubbles: true, composed: true }));
  }
}

if (!customElements.get('wero-card')) customElements.define('wero-card', WeroCard);
if (!customElements.get('wero-card-editor')) customElements.define('wero-card-editor', WeroCardEditor);
console.info(`%c WERO-CARD %c v${WERO_CARD_VERSION} `, 'color:#1d1c1c;background:#fff48d;font-weight:700', 'color:#fff;background:#1d1c1c');
window.customCards = window.customCards || [];
if (!window.customCards.some((c) => c.type === 'wero-card')) {
  window.customCards.push({
    type: 'wero-card',
    name: 'Wero QR Card',
    description: 'Wero QR code, no CDN',
    preview: true,
    documentationURL: 'https://github.com/juju35/ha-wero-card',
  });
}
