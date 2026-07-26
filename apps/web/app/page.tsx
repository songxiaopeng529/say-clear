import Link from 'next/link';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const lowEfficiencyItems = [
  ['AI 自动总结全书', '思考的是 AI，不是你。获得感反而更弱。'],
  ['划线 / 摘抄工具', '只完成「捕获」，没有逼你输出，划完照样忘。'],
  ['读书社区 / 书评', '解决讨论，不解决个人内化，且多为浅层观点。'],
  ['听书稿 / 拆书稿', '别人嚼碎喂给你，二手知识，内化效率最低。'],
];

const solutionItems = [
  ['费曼闯关', 'AI 扮「听不懂的笨学生」，逼你用自己的话讲清楚。'],
  ['贴划线，给 AI 上下文', '你带素材，AI 基于你认为重要的内容追问。'],
  ['清晰度体检报告', '精准指出「一问就垮」的盲区，这才是真价值。'],
  ['你自己的观点卡片', '通关后沉淀的是你的话，不是 AI 的总结。'],
];

const steps = [
  [
    '1',
    '开一本书',
    '手动输入书名和作者即可。不需要书库，不依赖平台，任何你读过的书都可以用。',
  ],
  [
    '2',
    '贴上你的划线',
    '粘贴 1-3 句触动你的原文。筛选「什么最重要」这个动作本身就是内化。',
  ],
  [
    '3',
    '费曼闯关',
    'AI 扮「听不懂的笨学生」逼问你，讲不清就过不去。专挑含糊、术语堆砌、逻辑跳跃处反问。',
  ],
  [
    '4',
    '沉淀观点卡片',
    '通关后生成「我的观点卡片」。用你自己的话，不是 AI 总结。可编辑、可导出，越攒越厚。',
  ],
];

const featureCards = [
  [
    '无需标准答案',
    'AI 不需要读过你的书。只要你能讲清楚，它就认。全世界任何书都能用。',
    'M5 14.5 8 11l6-5',
  ],
  [
    '清晰度体检报告',
    '通关后精准标出讲清的绿点和「一问就垮」的红点，暴露你真正没懂的盲区。',
    'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16Zm0 4v4l3 2',
  ],
  [
    '你的认知资产',
    '每本书沉淀成你自己的观点卡片，带得走、可回看。读的越多，资产越厚。',
    'M12 4 4 8l8 4 8-4-8-4Zm-8 8 8 4 8-4M4 16l8 4 8-4',
  ],
];

async function getCurrentUser() {
  try {
    const supabase = createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user;
  } catch {
    return null;
  }
}

function metadataString(
  metadata: Record<string, unknown> | undefined,
  key: string,
) {
  const value = metadata?.[key];
  return typeof value === 'string' && value.trim() ? value : null;
}

export default async function HomePage() {
  const user = await getCurrentUser();
  const displayName =
    metadataString(user?.user_metadata, 'user_name') ??
    metadataString(user?.user_metadata, 'full_name') ??
    metadataString(user?.user_metadata, 'name') ??
    user?.email ??
    '已登录';
  const avatarUrl = metadataString(user?.user_metadata, 'avatar_url');
  const startHref = user ? '/shelf' : '/login';

  return (
    <main
      className="min-w-[1180px] bg-[#fafaf8] text-[#1a1a1a]"
      style={{
        fontFamily:
          'Inter, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
      }}
    >
      <header className="relative h-[68px] border-b border-[#e8e4dc] bg-[#fafaf8]">
        <Link
          href="/"
          className="absolute left-10 top-5 flex h-7 items-start gap-2"
          aria-label="SayClear 首页"
        >
          <span
            className="text-[22px] font-bold leading-[28px] tracking-[-0.5px]"
            style={{ fontFamily: 'Outfit, Inter, sans-serif' }}
          >
            SayClear
          </span>
          <span className="mt-1 rounded-full bg-[#f0ede6] px-2 text-[11px] font-medium leading-5 text-[#8b7355]">
            Beta
          </span>
        </Link>

        <nav className="absolute left-1/2 top-[24.5px] flex -translate-x-1/2 gap-10 text-[15px] leading-[19px] text-[#555]">
          <a href="#why">为什么 SayClear</a>
          <a href="#feynman">费曼闯关</a>
          <a href="#pricing">定价</a>
        </nav>

        <div className="absolute right-10 top-[15.5px] flex h-[37px] items-center gap-4 text-[15px] leading-[19px] text-[#555]">
          {user ? (
            <>
              <Link href="/shelf" className="max-w-[160px] truncate">
                {displayName}
              </Link>
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={displayName}
                  className="h-9 w-9 rounded-full object-cover"
                />
              ) : (
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#1a1a1a] text-sm font-semibold text-white">
                  {displayName.slice(0, 1).toUpperCase()}
                </span>
              )}
            </>
          ) : (
            <>
              <Link href="/login">登录</Link>
              <Link
                href="/login"
                className="flex h-[37px] w-[104px] items-center justify-center rounded-lg bg-black text-[14px] font-medium leading-[17px] text-white"
              >
                免费开始
              </Link>
            </>
          )}
        </div>
      </header>

      <section className="relative h-[680px] bg-[#fafaf8]">
        <div className="absolute left-1/2 top-[120px] flex h-[27px] -translate-x-1/2 items-center justify-center rounded-full border border-[#d4cfc6] bg-white px-[14px] text-[12px] font-medium leading-[15px] text-[#8b7355]">
          AI 读书陪练
        </div>

        <div className="hero-title-frame absolute left-1/2 top-[171px] flex h-[151px] w-[900px] -translate-x-1/2 items-center justify-center rounded-3xl shadow-[0_8px_40px_rgba(162,155,254,0.19)] backdrop-blur-md">
          <h1
            className="relative z-10 text-[64px] font-bold leading-[70.4px] tracking-[-1.5px] text-[#00c896] drop-shadow-[0_0_24px_rgba(254,202,87,0.25)]"
            style={{ fontFamily: 'Outfit, Inter, "PingFang SC", sans-serif' }}
          >
            读完不算数，说清才算懂。
          </h1>
        </div>

        <p className="absolute left-1/2 top-[350px] w-[560px] -translate-x-1/2 text-center text-[18px] leading-[30.6px] text-[#666]">
          一个不掌握任何知识、却能倒逼你把读过的书讲清楚的 AI 读书陪练。
          <br />
          用费曼学习法，暴露你真正没懂的地方。
        </p>

        <Link
          href={startHref}
          className="absolute left-1/2 top-[452px] flex h-[52px] w-[140px] -translate-x-1/2 items-center justify-center rounded-lg border border-[#3d8a5a] text-[17px] font-medium leading-[20px] text-[#6ec494]"
        >
          开始闯关
        </Link>

        <div className="absolute left-1/2 top-[544px] flex -translate-x-1/2 gap-6 whitespace-nowrap text-[13px] leading-4 text-[#aaa]">
          <span>· 无需注册即可体验</span>
          <span>· 任何书都能用</span>
          <span>· 你的话，非 AI 总结</span>
        </div>
      </section>

      <section id="preview" className="relative h-[640px] bg-[#fafaf8]">
        <div className="absolute left-1/2 top-0 flex h-[560px] w-[1100px] -translate-x-1/2 overflow-hidden rounded-2xl border border-[#e8e4dc] bg-white shadow-[0_16px_40px_rgba(0,0,0,0.07)]">
          <aside className="h-full w-[220px] border-r border-[#e8e4dc] bg-[#f5f2ed]">
            <div className="px-4 pt-5 text-[16px] font-bold leading-5">SayClear</div>
            <div className="mt-6 px-4 text-[12px] font-semibold leading-[15px] tracking-[1px] text-[#8b7355]">
              我的书架
            </div>
            {['《思考，快与慢》', '《穷查理宝典》', '《原则》'].map((book, index) => (
              <div
                key={book}
                className={`mx-4 mt-1 flex h-8 items-center rounded-md px-2.5 text-[13px] leading-4 ${
                  index === 0
                    ? 'bg-[#ede8df] font-medium text-[#1a1a1a]'
                    : 'text-[#666]'
                }`}
              >
                {book}
              </div>
            ))}
          </aside>

          <div className="relative h-full w-[880px] bg-white">
            <div className="flex h-14 items-center justify-between border-b border-[#e8e4dc] px-6">
              <div>
                <div className="text-[15px] font-semibold leading-[19px]">思考，快与慢</div>
                <div className="mt-0.5 text-[12px] leading-[15px] text-[#aaa]">
                  丹尼尔·卡尼曼 · 费曼闯关进行中
                </div>
              </div>
              <div className="rounded-full border border-[#f5c9a8] bg-[#fff3ed] px-3 py-1 text-[12px] font-medium leading-[15px] text-[#c26a2d]">
                第 2 轮追问
              </div>
            </div>

            <div className="relative h-[444px]">
              <div className="absolute left-8 top-6 flex h-[72px] w-[416px] items-center rounded-xl border border-[#e8e4dc] bg-[#f5f2ed] px-[18px] text-[14px] leading-[22.4px] text-[#333]">
                好的，我假装完全没读过这本书。
                <br />
                请用 3 句话告诉我，它到底在讲什么？
              </div>

              <div className="absolute left-[472px] top-[116px] flex h-[94px] w-[376px] items-center rounded-xl bg-[#1a1a1a] px-[18px] text-[14px] leading-[22.4px] text-white">
                这本书说人有两套思维系统——快速直觉的系统1和慢速理性的系统2，我们大部分错误都是系统1偷懒导致的。
              </div>

              <div className="absolute left-8 top-[230px] flex h-[72px] w-[396px] items-center rounded-xl border border-[#e8e4dc] bg-[#f5f2ed] px-[18px] text-[14px] leading-[22.4px] text-[#333]">
                嗯，你说「系统1偷懒」——但这个「懒」是指什么？
                <br />
                它是意识到了但懒得想，还是压根不知道自己在偷懒？
              </div>
            </div>

            <div className="absolute bottom-0 left-0 flex h-[60px] w-full items-center gap-3 border-t border-[#e8e4dc] px-5">
              <div className="flex h-9 flex-1 items-center rounded-md border border-[#e8e4dc] bg-[#f5f2ed] px-3.5 text-[14px] leading-[17px] text-[#bbb]">
                继续说……
              </div>
              <button
                type="button"
                aria-label="发送"
                className="flex h-9 w-9 items-center justify-center rounded-md bg-[#1a1a1a] text-white"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path
                    d="M14 2 7.3 8.7M14 2 9.7 14 7.3 8.7 2 6.3 14 2Z"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </section>

      <section id="why" className="h-[909px] bg-[#f5f2ed] pt-[100px]">
        <SectionEyebrow>INSIGHT</SectionEyebrow>
        <h2 className="mt-[60px] text-center text-[44px] font-bold leading-[55.4px]">
          你读了很多书，但真的记住了吗？
        </h2>
        <p className="mx-auto mt-[60px] w-[560px] text-center text-[17px] leading-[27.2px] text-[#666]">
          没有输出的输入，几乎不产生内化。这是被反复验证的学习科学规律，不是你的问题。
        </p>

        <div className="mx-auto mt-[60px] grid w-[1280px] grid-cols-2 gap-6">
          <CompareCard title="现有方案的困境" items={lowEfficiencyItems} />
          <CompareCard title="SayClear 的解法" items={solutionItems} dark />
        </div>
      </section>

      <section className="h-[581px] bg-[#fafaf8] pt-[100px]">
        <SectionEyebrow>HOW IT WORKS</SectionEyebrow>
        <h2 className="mt-16 text-center text-[44px] font-bold leading-[55.4px]">
          四步，把「读过」变成「读懂」
        </h2>
        <div className="mx-auto mt-[64px] grid w-[1280px] grid-cols-4">
          {steps.map(([number, title, desc], index) => (
            <div key={title} className="relative h-[184px] pl-8 first:pl-0">
              {index > 0 && (
                <div className="absolute left-0 top-0 h-11 w-px bg-[#e8e4dc]" />
              )}
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-gradient-to-br from-[#4a9e6a] to-[#2e7248] text-[20px] font-bold leading-[25px] text-white">
                {number}
              </div>
              <h3 className="mt-5 text-[22px] font-bold leading-[27.7px]">{title}</h3>
              <p className="mt-[19px] w-[288px] text-[15px] leading-6 text-[#666]">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="feynman" className="h-[670px] bg-[#fafaf8] pt-[100px]">
        <SectionEyebrow>FEATURES</SectionEyebrow>
        <h2 className="mt-14 text-center text-[44px] font-bold leading-[55.4px]">
          产品心脏：费曼闯关
        </h2>
        <p className="mx-auto mt-14 w-[600px] text-center text-[17px] leading-[27.2px] text-[#666]">
          唯一一个不掌握知识、却能逼你讲清楚的 AI。判断「讲清楚没」，而不是「答对没」。
        </p>

        <div className="mx-auto mt-14 grid w-[1280px] grid-cols-3 gap-5">
          {featureCards.map(([title, desc, icon]) => (
            <article
              key={title}
              className="h-[179px] rounded-xl border border-[#e8e4dc] bg-white px-7 pt-7"
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                className="text-[#3d8a5a]"
                aria-hidden="true"
              >
                <path
                  d={icon}
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <h3 className="mt-4 text-[18px] font-bold leading-[22.7px]">{title}</h3>
              <p className="mt-3 text-[14px] leading-[22.4px] text-[#666]">{desc}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="pricing" className="h-[549px] bg-[#1a1a1a] pt-[100px] text-center">
        <h2 className="text-[60px] font-bold leading-[63px] tracking-[-1.5px] text-white">
          读完不算数，
        </h2>
        <div className="mt-8 text-[60px] font-bold leading-[63px] tracking-[-1.5px] text-[#6ec494]">
          说清才算懂。
        </div>
        <p className="mt-8 text-[18px] leading-[27px] text-[#888]">
          现在就开始你的第一本书，免费体验费曼闯关。
        </p>
        <div className="mt-8 flex justify-center gap-4">
          <Link
            href={startHref}
            className="flex h-[52px] w-[174px] items-center justify-center rounded-lg bg-gradient-to-br from-[#4a9e6a] to-[#2e7248] text-[17px] font-semibold leading-[20px] text-white"
          >
            免费开始闯关
          </Link>
          <a
            href="#preview"
            className="flex h-[52px] w-[157px] items-center justify-center rounded-lg border border-[#3d8a5a] bg-[#1f3e2c] text-[17px] font-medium leading-[20px] text-[#6ec494]"
          >
            看完整演示
          </a>
        </div>
        <p className="mt-8 text-[13px] leading-4 text-[#555]">无需信用卡 · 免费开始 · 随时取消</p>
      </section>

      <footer className="relative h-[109px] border-t border-[#e8e4dc] bg-[#fafaf8]">
        <div className="absolute left-20 top-8">
          <div className="text-[18px] font-bold leading-[23px]">SayClear</div>
          <div className="mt-1.5 text-[13px] leading-4 text-[#aaa]">读完不算数，说清才算懂。</div>
        </div>
        <div className="absolute right-20 top-[46px] flex gap-8 text-[14px] leading-[17px] text-[#888]">
          <a href="#why">产品介绍</a>
          <a href="#pricing">定价</a>
          <span>联系我们</span>
          <span className="text-[13px] leading-4 text-[#ccc]">© 2026 SayClear</span>
        </div>
      </footer>
    </main>
  );
}

function SectionEyebrow({ children }: { children: string }) {
  return (
    <div className="text-center text-[11px] font-semibold leading-[14px] tracking-[3px] text-[#3d8a5a]">
      {children}
    </div>
  );
}

function CompareCard({
  title,
  items,
  dark = false,
}: {
  title: string;
  items: string[][];
  dark?: boolean;
}) {
  return (
    <div
      className={`h-[406px] rounded-xl ${
        dark ? 'bg-black' : 'border border-[#e8e4dc] bg-white'
      } px-8 pt-8`}
    >
      <div
        className={`text-[11px] font-semibold leading-[14px] tracking-[2px] ${
          dark ? 'text-white' : 'text-[#aaa]'
        }`}
      >
        {title}
      </div>
      <div className="mt-3 space-y-3">
        {items.map(([itemTitle, desc]) => (
          <div
            key={itemTitle}
            className={`h-[70px] rounded-lg border px-4 py-3.5 ${
              dark
                ? 'border-[#333] bg-[#1a1a1a]'
                : 'border-[#ede8df] bg-[#faf8f5]'
            }`}
          >
            <div
              className={`text-[14px] font-semibold leading-[17px] ${
                dark ? 'text-[#39d353]' : 'text-[#555]'
              }`}
            >
              {itemTitle}
            </div>
            <div
              className={`mt-1.5 text-[13px] leading-[19.5px] ${
                dark ? 'text-white' : 'text-[#999]'
              }`}
            >
              {desc}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
