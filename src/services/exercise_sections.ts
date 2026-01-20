import { TableColumn } from "./table_section_service";

export type ExerciseSection =
  | {
      kind?: "questions";
      title: string;
      defaultBody: string;
      questions?: string[];
      layout?: "vertical";
    }
  | {
      kind: "list";
      title: string;
      defaultBody: string;
      legacyQuestions?: string[];
    }
  | {
      kind: "pairs";
      title: string;
      defaultBody: string;
    }
  | {
      kind: "qa";
      title: string;
      defaultBody: string;
    }
  | {
      kind: "table";
      title: string;
      tableType: "Quotes";
      columns: TableColumn[];
    };

export const BASE_EXERCISE_SECTIONS: ExerciseSection[] = [
  {
    title: "価値観分析",
    defaultBody: "",
    questions: [
      "あなたはなぜ今の会社(学校)に入りましたか？",
      "あなたはなぜ今の趣味を始めたのですか？",
      "あなたはなぜこの場所に住んでるのですか？",
      "これまでに会った人で、ぜひもう一度会いたいと思う人は？",
      "あなたが一番好きな言葉は？",
      "あなたがこれまでに読んだ一番好きな本は？",
      "これまでの仕事で一番充実していたことは？いつ？どんな仕事？なぜ？",
      "家族との思い出で一番楽しかったことは？いつ？どんな内容？なぜ？",
      "人と接する上で何が一番大切ですか？",
      "失うと気力がなくなるものはなんですか？",
      "今後の人生において最も身につけたい才能や能力は何ですか？",
      "あなたがこれまで最もわくわくしたことはどのようなことでしたか？",
      "あなたが心のそこから「リラックス」できる時間はどのような時ですか？",
      "あなたの理想とする人は、何をもっとも大事にしているのでしょうか？",
      "人生の中で学ぶことの多かった失敗、挫折体験は何ですか？",
      "仕事とプライベートで共通して言える指針は何ですか？",
      "あなたの人生の中で、充実感の高かった成功体験はなんでしたか？",
      "毎日の生活で気をつけていることは何ですか？",
      "私生活で最も価値があると考える行動は何ですか？",
      "今、十分な時間があれば誰と何をしたいですか？",
      "これからの人生で一番実現したいことは何ですか？",
      "あなたの理想とする人生はどのようなことをして成し遂げた人ですか？",
      "あなたの人生の中で大きな影響を受けた人はどんな点が最も優れていましたか？",
    ],
    layout: "vertical",
  },
  {
    kind: "list",
    title: "余命1年リスト",
    defaultBody: "",
    legacyQuestions: ["「余命1年」だったら何をしたい？"],
  },
  {
    kind: "list",
    title: "あと100年人生リスト",
    defaultBody: "",
    legacyQuestions: ["健康体であと100年生きられるとしたら何をしたい？"],
  },
  {
    kind: "list",
    title: "死ぬまでにやりたいこと",
    defaultBody: "",
    legacyQuestions: ["何をしたい？"],
  },
  {
    title: "立場を変えて考える",
    defaultBody: "",
    questions: [
      "誰の立場で考えますか？",
      "その人はあなたに対して何を望んでますか？何をいやだと思ってますか？",
      "望まれていることを実現するにはどうしたら良いですか？",
    ],
    layout: "vertical",
  },
  {
    title: "憧れの人物",
    defaultBody: "",
    questions: ["誰の？どんなところ？"],
    layout: "vertical",
  },
  {
    title: "20年後の自分へインタビュー",
    defaultBody: "",
    questions: [
      "誰と一緒でしたか？",
      "どのような車に乗り、どんな身なりでしたか？",
      "今現在どんな仕事をしているようでしたか？",
      "どんな所に住んでいそうでしたか？",
      "あなたが今一番大切なものは何ですか？",
      "あなたがそのような成功を収めたのはどうしてでしょうか？",
      "そのように運にも恵まれるには、あなたが何をしてきたからですか？",
      "今思えば何が転機でしたか？そこでどんな判断をしたのですか？",
      "今、何をしているときが一番楽しいですか？",
      "あなたを一番支えてくれた人は誰でしたか？",
    ],
    layout: "vertical",
  },
  {
    kind: "table",
    title: "心に残った言葉・座右の銘",
    tableType: "Quotes",
    columns: [
      {
        label: "種別",
        type: "select",
        options: ["心に残った言葉", "座右の銘"],
        width: "minmax(120px, 140px)",
      },
      { label: "内容", type: "text", multiline: true },
    ],
  },
];

export function buildExerciseSectionTitles(
  customSections: Array<{ title?: string | null }> = []
): string[] {
  const titles = BASE_EXERCISE_SECTIONS.map((section) => section.title);
  const known = new Set(titles.map((title) => title.trim().toLowerCase()));
  customSections.forEach((section) => {
    const title = section?.title?.trim() ?? "";
    if (!title) {
      return;
    }
    const key = title.toLowerCase();
    if (known.has(key)) {
      return;
    }
    known.add(key);
    titles.push(title);
  });
  return titles;
}
