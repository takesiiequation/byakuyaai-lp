import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { isMeAuthed } from "@/app/_lib/meAuth";
import s from "./week.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "85点の一週間",
  robots: { index: false, follow: false },
};

export default async function WeekPage() {
  if (!(await isMeAuthed())) redirect("/me/login");
  return (
    <div className={s.wrap}>

    <header className={s.hero}>
      <p className={s.kick}>Nutrition & Training · 週次プロトコル</p>
      <h1>85点の一週間</h1>
      <p className={s.dek}>自炊も洗い物も増やさずにタンパク質を目標まで積む型。日曜の15分が平日を全部支える。</p>
      <div className={s.kpis}>
        <div className={s.kpi}><div className={s.v}><s>68</s> <b>→ 85</b></div><div className={s.k}>採点</div></div>
        <div className={s.kpi}><div className={s.v}><b>105–125</b></div><div className={s.k}>推定 P g/日</div></div>
        <div className={s.kpi}><div className={s.v}>104–130</div><div className={s.k}>目標 g/日</div></div>
        <div className={s.kpi}><div className={s.v}><b>3,500</b></div><div className={s.k}>週の食費 円</div></div>
      </div>
    </header>

    <section>
      <div className={`${s.card} ${s.prep}`}>
        <h2>日曜にやること</h2>
        <p className={s.sub} style={{ marginBottom: "0" }}>これをやらないと平日が崩れる。所要 約30分。</p>
        <ol>
          <li><div>買い出し（ベルク）<span className={s.t}>揚げ物と鶏皮は買わない</span></div></li>
          <li><div>ゆで卵を10個まとめて茹でて冷蔵<span className={s.t}>15分。皿を使わないので洗い物ゼロ</span></div></li>
          <li><div>鶏ももを1食分ずつラップ＋ジップロックで冷凍<span className={s.t}>週1買い出しでも腐らせない</span></div></li>
          <li><div>翌日ぶんを冷蔵庫へ移す<span className={s.t}>常温解凍は絶対にしない</span></div></li>
        </ol>
      </div>
    </section>

    <section>
      <h2>買い物リスト</h2>
      <p className={s.sub}>タップでチェックできる。レジ前の確認用。</p>
      <div className={s.card}>
        <div className={s.cg}><div className={s.cl}>たんぱく質</div><div className={s.items}>
          <label><input type="checkbox" /><span className={s.bx}></span><span className={s.tx}>鶏もも肉</span> <span className={s.q}>2枚／8月は1枚</span></label>
          <label><input type="checkbox" /><span className={s.bx}></span><span className={s.tx}>塩鮭</span> <span className={s.q}>5切</span></label>
          <label><input type="checkbox" /><span className={s.bx}></span><span className={s.tx}>納豆</span> <span className={s.q}>6パック</span></label>
          <label><input type="checkbox" /><span className={s.bx}></span><span className={s.tx}>卵</span> <span className={s.q}>2パック</span></label>
        </div></div>
        <div className={s.cg}><div className={s.cl}>野菜・果物</div><div className={s.items}>
          <label><input type="checkbox" /><span className={s.bx}></span><span className={s.tx}>冷凍ブロッコリー</span></label>
          <label><input type="checkbox" /><span className={s.bx}></span><span className={s.tx}>アボカド</span> <span className={s.q}>2個</span></label>
          <label><input type="checkbox" /><span className={s.bx}></span><span className={s.tx}>バナナ</span></label>
        </div></div>
        <div className={s.cg}><div className={s.cl}>間食・その他</div><div className={s.items}>
          <label><input type="checkbox" /><span className={s.bx}></span><span className={s.tx}>素焼き無塩ナッツ</span></label>
          <label><input type="checkbox" /><span className={s.bx}></span><span className={s.tx}>サラダチキン</span> <span className={s.q}>2〜3個</span></label>
          <label><input type="checkbox" /><span className={s.bx}></span><span className={s.tx}>モンスターウルトラ</span> <span className={s.q}>3本</span></label>
          <label><input type="checkbox" /><span className={s.bx}></span><span className={s.tx}>米</span> <span className={s.q}>月1</span></label>
        </div></div>
        <div className={s.cg} style={{ marginBottom: "0" }}><div className={s.cl}>見つけたら</div><div className={s.items}>
          <label><input type="checkbox" /><span className={s.bx}></span><span className={s.tx}>半額の焼き鳥</span> <span className={s.q}>皮は避ける</span></label>
        </div></div>
      </div>
    </section>

    <section>
      <h2>週の献立</h2>
      <p className={s.sub}>朝は「作る」のではなく「冷蔵庫から出す」。トレーニングは月〜木。</p>

      <div className={`${s.day} ${s.tr}`}>
        <div className={s.dh}><div className={s.dw}>月</div><div className={`${s.sp} ${s.on}`}>胸</div></div>
        <dl className={s.ml}>
          <div className={s.m}><dt>朝</dt><dd>ゆで卵2＋バナナ</dd></div>
          <div className={s.m}><dt>昼</dt><dd>食堂 Aランチ</dd></div>
          <div className={s.m}><dt>夜</dt><dd>鶏もも＋ブロッコリー＋ご飯＋卵</dd></div>
          <div className={s.m}><dt>ジム後</dt><dd>プロテイン 1杯</dd></div>
        </dl>
        <div className={s.pg}>120<span>g protein</span></div>
      </div>

      <div className={`${s.day} ${s.tr}`}>
        <div className={s.dh}><div className={s.dw}>火</div><div className={`${s.sp} ${s.on}`}>肩</div></div>
        <dl className={s.ml}>
          <div className={s.m}><dt>朝</dt><dd>ゆで卵2＋バナナ</dd></div>
          <div className={s.m}><dt>昼</dt><dd>食堂 Aランチ</dd></div>
          <div className={s.m}><dt>夜</dt><dd>塩鮭＋納豆＋ご飯＋ブロッコリー</dd></div>
          <div className={s.m}><dt>ジム後</dt><dd>プロテイン 1杯</dd></div>
        </dl>
        <div className={s.pg}>125<span>g protein</span></div>
      </div>

      <div className={`${s.day} ${s.tr}`}>
        <div className={s.dh}><div className={s.dw}>水</div><div className={`${s.sp} ${s.on}`}>腕</div></div>
        <dl className={s.ml}>
          <div className={s.m}><dt>朝</dt><dd>ゆで卵2＋バナナ</dd></div>
          <div className={s.m}><dt>昼</dt><dd>食堂 Aランチ</dd></div>
          <div className={s.m}><dt>夜</dt><dd>鶏もも＋アボカド＋ご飯</dd></div>
          <div className={s.m}><dt>ジム後</dt><dd>プロテイン 1杯</dd></div>
        </dl>
        <div className={s.pg}>130<span>g protein</span></div>
      </div>

      <div className={`${s.day} ${s.tr}`}>
        <div className={s.dh}><div className={s.dw}>木</div><div className={`${s.sp} ${s.on}`}>背中</div></div>
        <dl className={s.ml}>
          <div className={s.m}><dt>朝</dt><dd>ゆで卵2＋バナナ</dd></div>
          <div className={s.m}><dt>昼</dt><dd>食堂 Aランチ</dd></div>
          <div className={s.m}><dt>夜</dt><dd>焼鳥＋納豆＋ご飯＋ブロッコリー</dd></div>
          <div className={s.m}><dt>ジム後</dt><dd>プロテイン 1杯</dd></div>
        </dl>
        <div className={s.pg}>125<span>g protein</span></div>
      </div>

      <div className={s.day}>
        <div className={s.dh}><div className={s.dw}>金</div><div className={`${s.sp} ${s.off}`}>休養</div></div>
        <dl className={s.ml}>
          <div className={s.m}><dt>朝</dt><dd>ゆで卵2＋バナナ</dd></div>
          <div className={s.m}><dt>昼</dt><dd>食堂 Aランチ</dd></div>
          <div className={s.m}><dt>夜</dt><dd>塩鮭＋ご飯＋卵＋ブロッコリー</dd></div>
        </dl>
        <div className={s.pg}>105<span>g protein</span></div>
      </div>

      <div className={s.day}>
        <div className={s.dh}><div className={s.dw}>土</div><div className={`${s.sp} ${s.off}`}>休養</div></div>
        <dl className={s.ml}>
          <div className={s.m}><dt>朝昼</dt><dd>納豆卵ご飯＋ゆで卵2</dd></div>
          <div className={s.m}><dt>夜</dt><dd>鶏もも＋アボカド＋ご飯</dd></div>
          <div className={s.m}><dt>間食</dt><dd>ヨーグルト＋蜂蜜／ナッツ</dd></div>
        </dl>
        <div className={s.pg}>110<span>g protein</span></div>
      </div>

      <div className={s.day}>
        <div className={s.dh}><div className={s.dw}>日</div><div className={`${s.sp} ${s.off}`}>仕込み</div></div>
        <dl className={s.ml}>
          <div className={s.m}><dt>朝昼</dt><dd>納豆卵ご飯＋塩鮭</dd></div>
          <div className={s.m}><dt>夜</dt><dd>惣菜（揚げ物以外）＋ブロッコリー</dd></div>
          <div className={s.m}><dt>間食</dt><dd>串団子</dd></div>
        </dl>
        <div className={s.pg}>105<span>g protein</span></div>
      </div>
    </section>

    <section>
      <h2>サプリとジム</h2>
      <p className={s.sub}>サプリは全部まとめて夕食後30分以内。1回で終わらせる。</p>
      <div className={s.two}>
        <div className={`${s.card} ${s.blk}`}>
          <h3>夕食後 30分以内</h3>
          <ul>
            <li><span className={s.dot}></span><div>ビタミン D3</div></li>
            <li><span className={s.dot}></span><div>マグネシウム <span className={s.q}>グリシン酸・半割</span></div></li>
            <li><span className={s.dot}></span><div>亜鉛 <span className={s.q}>半割で 25 mg</span></div></li>
            <li><span className={s.dot}></span><div>オメガ3</div></li>
            <li><span className={s.dot}></span><div>ビタミン C <span className={s.q}>500–1000 mg</span></div></li>
            <li><span className={`${s.dot} ${s.mute}`}></span><div>ビタミンB群 <span className={s.q}>休止中</span></div></li>
          </ul>
          <div className={s.note}>別枠 — <b>クレアチン 3–5 g を水で毎日</b>（休養日こそ飲む）／フィナステリド・ミノキシジル</div>
        </div>
        <div className={`${s.card} ${s.blk}`}>
          <h3>ジム 月〜木・部位分割</h3>
          <ul>
            <li><span className={s.dot}></span><div>月 — 胸 <span className={s.q}>インクラインを最初に</span></div></li>
            <li><span className={s.dot}></span><div>火 — 肩</div></li>
            <li><span className={s.dot}></span><div>水 — 腕</div></li>
            <li><span className={s.dot}></span><div>木 — 背中</div></li>
            <li><span className={`${s.dot} ${s.mute}`}></span><div>金土日 — 休養</div></li>
          </ul>
          <div className={s.note}>復帰初日は <b>50 kg × 12</b> から。70 kg は触らない。比べる相手は過去の自分ではなく先月の自分。</div>
        </div>
      </div>
    </section>

    <section>
      <h2>守るルール</h2>
      <div className={s.card}>
        <div className={s.rule}><div className={s.rn}>01</div><div><strong>揚げ物と鶏皮は買わない</strong><em>カロリーの正体は「もも」ではなく「皮」。ももは食べていい。</em></div></div>
        <div className={s.rule}><div className={s.rn}>02</div><div><strong>白米を抜かない</strong><em>カロリー不足だとタンパク質がエネルギーとして燃やされる。</em></div></div>
        <div className={s.rule}><div className={s.rn}>03</div><div><strong>カフェインは15時以降ゼロ</strong><em>半減期5〜6時間。オフ日を連続にするより睡眠への効果が大きい。</em></div></div>
        <div className={s.rule}><div className={s.rn}>04</div><div><strong>常温解凍しない</strong><em>前日に冷蔵庫へ移す。夏の失敗はここから起きる。</em></div></div>
        <div className={s.rule}><div className={s.rn}>05</div><div><strong>外食は月1枠</strong><em>スタバ・ラーメン・マクド。回転寿司は2週に1回。</em></div></div>
      </div>
      <div className={s.flag}><b>家系ラーメン</b> — 1杯で食塩相当量6〜8g、スープ完飲で8〜10g。男性の1日目標は7.5g未満なので<b>1杯で1日分</b>を使い切る。<b>スープを残すだけで問題の7割が消える</b>ので、付き合い自体は断らなくていい。</div>
    </section>

    <Link className={s.back} href="/me">← 85点の毎日（記録アプリ）</Link>

    <footer>
      <div>更新 2026-08-22</div>
      <div>SecondBrain / Self_Improvement / 05_nutrition</div>
    </footer>
    </div>
  );
}
