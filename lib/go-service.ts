import type { Client, Transaction } from '@libsql/client';
import { areaScore, emptyBoard, placeStone } from './go-rules';

type Query = Pick<Client | Transaction, 'execute'>;

export async function readGame(query: Query, id: string, viewer: string) {
  return (await query.execute({
    sql: `SELECT g.*, b.pen_name AS black_name, w.pen_name AS white_name FROM go_games g
      JOIN public_users b ON b.id=g.black_id JOIN public_users w ON w.id=g.white_id
      WHERE g.id=? AND (g.black_id=? OR g.white_id=?) AND b.banned=0 AND w.banned=0
      AND NOT EXISTS(SELECT 1 FROM user_blocks x WHERE
        (x.blocker_id=g.black_id AND x.blocked_id=g.white_id) OR
        (x.blocker_id=g.white_id AND x.blocked_id=g.black_id))`,
    args:[id, viewer, viewer],
  })).rows[0];
}

export async function playGo(client: Client, viewer: string, input: Record<string,string>) {
  const tx = await client.transaction('write');
  try {
    const now = Date.now();
    if (input.op === 'invite') {
      const peer = (await tx.execute({
        sql: `SELECT u.id FROM public_users u WHERE u.pen_name=? AND u.id<>? AND u.banned=0
          AND EXISTS(SELECT 1 FROM letters l WHERE l.deliver_at<=? AND l.moderation_hidden=0 AND l.burned=0
            AND ((l.author_id=? AND l.recipient_id=u.id) OR (l.author_id=u.id AND l.recipient_id=?)))
          AND NOT EXISTS(SELECT 1 FROM user_blocks b WHERE
            (b.blocker_id=u.id AND b.blocked_id=?) OR (b.blocker_id=? AND b.blocked_id=u.id))`,
        args:[input.peer,viewer,now,viewer,viewer,viewer,viewer],
      })).rows[0];
      if (!peer) throw Error('请选择有过通信且可互动的笔友');
      const existing = (await tx.execute({
        sql: `SELECT id FROM go_games WHERE state IN ('invited','playing','scoring')
          AND ((black_id=? AND white_id=?) OR (black_id=? AND white_id=?)) LIMIT 1`,
        args:[viewer,String(peer.id),String(peer.id),viewer],
      })).rows[0];
      if (existing) { await tx.commit(); return String(existing.id); }
      const id = crypto.randomUUID();
      await tx.execute({sql:'INSERT INTO go_games(id,black_id,white_id,board,updated_at) VALUES(?,?,?,?,?)',args:[id,viewer,String(peer.id),emptyBoard,now]});
      await tx.execute({sql:'INSERT INTO go_positions VALUES(?,?)',args:[id,emptyBoard]});
      await tx.commit();
      return id;
    }
    const game = await readGame(tx,input.id,viewer);
    if (!game) throw Error('此棋局不可访问');
    if (String(game.revision)!==input.revision) throw Error('棋局已更新，请核对当前棋盘');
    const color = game.black_id===viewer ? 1 : 2;
    let board=String(game.board), state=String(game.state), turn=Number(game.turn);
    let passes=Number(game.passes), dead=String(game.dead), acceptedBy=Number(game.accepted_by), result='';
    if (state==='invited' && input.op==='cancel') state='cancelled';
    else if (state==='invited' && color===2 && input.op==='accept') state='playing';
    else if (['playing','scoring'].includes(state) && input.op==='resign') {
      state='finished';
      result=color===1?'黑方认输':'白方认输';
    } else if (state==='playing' && color===turn && input.op==='pass') {
      turn=3-turn;
      passes++;
      if (passes===2) state='scoring';
    } else if (state==='playing' && color===turn && input.op==='move') {
      if (!/^\d{1,2}$/.test(input.point||'')) throw Error('请选择交叉点');
      const history=(await tx.execute({sql:'SELECT board FROM go_positions WHERE game_id=?',args:[input.id]})).rows;
      board=placeStone(board,Number(input.point),color,new Set(history.map(row=>String(row.board))));
      await tx.execute({sql:'INSERT INTO go_positions VALUES(?,?)',args:[input.id,board]});
      turn=3-turn;
      passes=0;
    } else if (state==='scoring' && input.op==='resume') {
      state='playing';
      passes=0; dead=''; acceptedBy=0;
    } else if (state==='scoring' && input.op==='mark') {
      const points=new Set(dead?dead.split(',').map(Number):[]);
      const point=Number(input.point);
      if (!/^\d{1,2}$/.test(input.point||'')) throw Error('请选择棋子');
      if (points.has(point)) points.delete(point);
      else points.add(point);
      areaScore(board,points);
      dead=[...points].sort((a,b)=>a-b).join(',');
      acceptedBy=0;
    } else if (state==='scoring' && input.op==='score') {
      if (acceptedBy===color) throw Error('已确认，等对方核对');
      if (acceptedBy) {
        const score=areaScore(board,new Set(dead?dead.split(',').map(Number):[]));
        state='finished';
        result=`${score.black>score.white?'黑胜':'白胜'} · ${score.black} : ${score.white}`;
      } else acceptedBy=color;
    } else throw Error('当前回合不可进行此操作');

    await tx.execute({
      sql:`UPDATE go_games SET board=?,state=?,turn=?,passes=?,dead=?,accepted_by=?,result=?,
        updated_at=?,revision=revision+1 WHERE id=? AND revision=?`,
      args:[board,state,turn,passes,dead,acceptedBy,result,now,input.id,Number(game.revision)],
    });
    await tx.commit();
    return input.id;
  } catch (error) { await tx.rollback(); throw error; }
  finally { tx.close(); }
}
