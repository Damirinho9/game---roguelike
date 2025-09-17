(function(){
  'use strict';

  // Настройки карты
  var W = 40, H = 24;
  var NUM_ROOMS_MIN=5, NUM_ROOMS_MAX=10;
  var ROOM_MIN=3, ROOM_MAX=8;
  var CORRIDORS_PER_AXIS_MIN=3, CORRIDORS_PER_AXIS_MAX=5;
  var ENEMIES = 10, POTIONS = 10, SWORDS = 2;

  // Состояние игры
  var state = {
    grid: [], // 2D массив: 'wall' | 'floor'
    items: {}, // key "x,y" -> {type:'potion'|'sword'}
    enemies: {}, // key -> {x,y,hp,atk}
    hero: {x:0,y:0,hp:100,atk:10,maxhp:100}
  };

  // Утилиты
  function key(x,y){ return x+','+y; }
  function rnd(min,max){ return Math.floor(Math.random()*(max-min+1))+min; }
  function clamp(v,a,b){ return v<a?a:(v>b?b:v); }
  function inBounds(x,y){ return x>=0 && y>=0 && x<W && y<H; }

  function initGrid(){
    state.grid = new Array(H);
    for(var y=0;y<H;y++){
      state.grid[y] = new Array(W);
      for(var x=0;x<W;x++) state.grid[y][x] = 'wall';
    }
    state.items = {};
    state.enemies = {};
  }

  function carveRect(x,y,w,h){
    for(var j=0;j<h;j++) for(var i=0;i<w;i++){
      var xx=x+i, yy=y+j;
      if(inBounds(xx,yy)) state.grid[yy][xx] = 'floor';
    }
  }

  // Создать прямоугольные комнаты без явного пересечения (c зазором 1)
  function placeRooms(){
    var rooms=[], attempts=0, target=rnd(NUM_ROOMS_MIN, NUM_ROOMS_MAX);
    while(rooms.length<target && attempts<200){
      attempts++;
      var rw=rnd(ROOM_MIN,ROOM_MAX), rh=rnd(ROOM_MIN,ROOM_MAX);
      var rx=rnd(1,W-rw-2), ry=rnd(1,H-rh-2);
      // проверяем пересечения
      var ok=true;
      for(var k=0;k<rooms.length;k++){
        var r=rooms[k];
        if(!(rx+rw+1<r.x || r.x+r.w+1<rx || ry+rh+1<r.y || r.y+r.h+1<ry)){ ok=false; break; }
      }
      if(!ok) continue;
      rooms.push({x:rx,y:ry,w:rw,h:rh});
      carveRect(rx,ry,rw,rh);
    }
    return rooms;
  }

  // Коридоры на всю карту
  function carveGlobalCorridors(){
    var nH=rnd(CORRIDORS_PER_AXIS_MIN, CORRIDORS_PER_AXIS_MAX);
    var rows = {};
    for(var i=0;i<nH;i++){
      var y = rnd(2,H-3);
      rows[y]=true;
    }
    for(var y in rows){
      for(var x=0;x<W;x++) state.grid[y][x] = 'floor';
    }
    var nV=rnd(CORRIDORS_PER_AXIS_MIN, CORRIDORS_PER_AXIS_MAX);
    var cols = {};
    for(var j=0;j<nV;j++){
      var x = rnd(2,W-3);
      cols[x]=true;
    }
    for(var x in cols){
      for(var y=0;y<H;y++) state.grid[y][x] = 'floor';
    }
    return {rows:Object.keys(rows).map(Number), cols:Object.keys(cols).map(Number)};
  }

  // Соединить центр комнаты с ближайшим коридором
  function connectRoomsToCorridors(rooms, corridors){
    function carveLine(x0,y0,x1,y1){
      var x=x0,y=y0;
      while(x!==x1){ state.grid[y][x]= 'floor'; x += (x1>x)?1:-1; }
      while(y!==y1){ state.grid[y][x]= 'floor'; y += (y1>y)?1:-1; }
      state.grid[y][x]='floor';
    }
    for(var r=0;r<rooms.length;r++){
      var room=rooms[r];
      var cx = Math.floor(room.x+room.w/2), cy=Math.floor(room.y+room.h/2);
      // ближайшая вертикаль / горизонталь
      var bestX=cx, bestY=cy, d=1e9;
      for(var i=0;i<corridors.cols.length;i++){
        var x=corridors.cols[i]; var dist=Math.abs(x-cx);
        if(dist<d){ d=dist; bestX=x; bestY=cy; }
      }
      for(var j=0;j<corridors.rows.length;j++){
        var y=corridors.rows[j]; var dist=Math.abs(y-cy);
        if(dist<d){ d=dist; bestX=cx; bestY=y; }
      }
      carveLine(cx,cy,bestX,bestY);
    }
  }

  // Случайная пустая клетка
  function randomFloor(){
    var tries=0;
    while(tries<10000){
      tries++;
      var x=rnd(0,W-1), y=rnd(0,H-1);
      if(state.grid[y][x] === 'floor' && !state.items[key(x,y)] && !findEnemy(x,y) && !(state.hero.x===x && state.hero.y===y)){
        return {x:x,y:y};
      }
    }
    return null;
  }

  function findEnemy(x,y){
    for(var id in state.enemies){
      var e=state.enemies[id];
      if(e.x===x && e.y===y) return e;
    }
    return null;
  }

  function placeEntities(){
    // герой
    var p=randomFloor();
    state.hero.x=p.x; state.hero.y=p.y;
    // враги
    for(var i=0;i<ENEMIES;i++){
      var t=randomFloor();
      state.enemies['e'+i]={x:t.x,y:t.y,hp:100,atk:8,maxhp:100};
    }
    // предметы
    for(var j=0;j<POTIONS;j++){
      var pp=randomFloor();
      state.items[key(pp.x,pp.y)]={type:'potion'};
    }
    for(var s=0;s<SWORDS;s++){
      var ss=randomFloor();
      state.items[key(ss.x,ss.y)]={type:'sword'};
    }
  }

  // Рендер очередного состояния в DOM
  var fieldEl = document.getElementById('field');
  function render(){
    // Clear
    while(fieldEl.firstChild) fieldEl.removeChild(fieldEl.firstChild);
    for(var y=0;y<H;y++){
      for(var x=0;x<W;x++){
        var t=document.createElement('div');
        var cell=state.grid[y][x];
        t.className='tile '+(cell==='wall'?'wall':'floor');
        // предметы
        var it=state.items[key(x,y)];
        if(it){
          t.className+=' item';
          var tok=document.createElement('div'); tok.className='token '+it.type;
          t.appendChild(tok);
        }
        // враг
        var enemy=findEnemy(x,y);
        if(enemy){
          t.className+=' enemy hp-enemy';
          var tokE=document.createElement('div'); tokE.className='token enemy';
          t.appendChild(tokE);
          var hb=document.createElement('div'); hb.className='health';
          var bar=document.createElement('span'); bar.style.width=(enemy.hp/enemy.maxhp*100).toFixed(0)+'%';
          hb.appendChild(bar); t.appendChild(hb);
        }
        // герой
        if(state.hero.x===x && state.hero.y===y){
          t.className+=' hero hp-hero';
          var tokH=document.createElement('div'); tokH.className='token hero';
          t.appendChild(tokH);
          var hbH=document.createElement('div'); hbH.className='health'; var barH=document.createElement('span');
          barH.style.width=(state.hero.hp/state.hero.maxhp*100).toFixed(0)+'%'; hbH.appendChild(barH); t.appendChild(hbH);
        }
        fieldEl.appendChild(t);
      }
    }
    document.getElementById('hp').textContent = state.hero.hp + ' / ' + state.hero.maxhp;
    document.getElementById('atk').textContent = state.hero.atk;
  }

  // Движение героя и логика предметов
  function tryMoveHero(dx,dy){
    var nx=state.hero.x+dx, ny=state.hero.y+dy;
    if(!inBounds(nx,ny) || state.grid[ny][nx]==='wall') return false;
    // если там враг — не двигаемся, удар нужно делать пробелом
    if(findEnemy(nx,ny)) return false;
    state.hero.x=nx; state.hero.y=ny;
    var it=state.items[key(nx,ny)];
    if(it){
      if(it.type==='potion'){
        state.hero.hp = clamp(state.hero.hp+40, 0, state.hero.maxhp);
      }else if(it.type==='sword'){
        state.hero.atk += 5;
      }
      delete state.items[key(nx,ny)];
    }
    return true;
  }

  // Атака героя по всем соседним (4-направления)
  function heroAttack(){
    var dirs=[[1,0],[-1,0],[0,1],[0,-1]];
    for(var id in state.enemies){
      var e=state.enemies[id];
      for(var i=0;i<dirs.length;i++){
        var d=dirs[i];
        if(e.x===state.hero.x+d[0] && e.y===state.hero.y+d[1]){
          e.hp -= state.hero.atk;
          if(e.hp<=0){ delete state.enemies[id]; }
          break;
        }
      }
    }
  }

  // Ход врагов: если рядом с героем — бьют, иначе случайно двигаются
  function enemiesAct(){
    var taken={};
    taken[key(state.hero.x,state.hero.y)] = true;
    // занятые клетки врагами
    for(var id1 in state.enemies){
      taken[key(state.enemies[id1].x, state.enemies[id1].y)] = true;
    }
    for(var id in state.enemies){
      var e=state.enemies[id];
      var dx=state.hero.x - e.x, dy=state.hero.y - e.y;
      if(Math.abs(dx)+Math.abs(dy)===1){
        // удар по герою
        state.hero.hp = clamp(state.hero.hp - e.atk, 0, state.hero.maxhp);
      }else{
        // случайное смещение — по одной оси, чтобы было предсказуемо
        var moveAxis = Math.random()<0.5 ? 'x':'y';
        var dir = Math.random()<0.5 ? -1:1;
        var nx=e.x, ny=e.y;
        if(moveAxis==='x'){ nx+=dir; } else { ny+=dir; }
        if(inBounds(nx,ny) && state.grid[ny][nx]==='floor' && !taken[key(nx,ny)]){
          // освободим старую и займем новую
          taken[key(e.x,e.y)] = false;
          e.x=nx; e.y=ny;
          taken[key(nx,ny)] = true;
        }
      }
    }
  }

  // Проверка конца игры
  function isGameOver(){
    if(state.hero.hp<=0){ alert('Герой пал. Нажмите R, чтобы начать заново.'); return true; }
    // победа, если все враги повержены
    for(var k in state.enemies){ return false; }
    alert('Победа! Все противники побеждены.\nНажмите R для новой карты.');
    return true;
  }

  // Генерация карты
  function generate(){
    initGrid();
    var rooms = placeRooms();
    var corridors = carveGlobalCorridors();
    connectRoomsToCorridors(rooms, corridors);
    placeEntities();
    render();
  }

  // Обработчики клавиш
  window.addEventListener('keydown', function(ev){
    var code = ev.key || ev.code;
    var acted=false;
    if(code==='a' || code==='A' || code==='ArrowLeft'){ acted = tryMoveHero(-1,0); }
    else if(code==='d' || code==='D' || code==='ArrowRight'){ acted = tryMoveHero(1,0); }
    else if(code==='w' || code==='W' || code==='ArrowUp'){ acted = tryMoveHero(0,-1); }
    else if(code==='s' || code==='S' || code==='ArrowDown'){ acted = tryMoveHero(0,1); }
    else if(code===' ' || code==='Space'){ heroAttack(); acted=true; }
    else if(code==='r' || code==='R'){ generate(); return; }
    if(acted){
      enemiesAct();
      render();
      if(isGameOver()){} // сообщение уже показано
    }else{
      render(); // на случай атаки
    }
  });

  // первый запуск
  generate();
})();