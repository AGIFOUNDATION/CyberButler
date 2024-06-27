globalThis.PromptLib = {};

PromptLib.assemble = (prompt, ...infos) => {
	if (!prompt) return "";
	if (infos.length === 0) return prompt;

	var info = Object.assign({}, ... infos);
	var regs = {};
	for (let key in info) {
		regs[key] = new RegExp("\\{\\{\\s*" + key + '\\s*\\}\\}', "g");
	}

	var temp;
	while (prompt !== temp) {
		temp = prompt;
		for (let key in info) {
			let value = info[key];
			let reg = regs[key];
			prompt = prompt.replace(reg, value);
		}
	}
	return prompt;
};

PromptLib.sayHello = `You are the user's personal assistant, your name is "Cyprite". Please greet the user.

# User Information

## User's Name

{{name}}

## User's Information

{{info}}

# Current Time

{{time}}

# Requirements

- You must greet in {{lang}}.
- Be friendly, natural, and humorous.
- The content of the greeting should match the current time (no neccessary to tell user the current time) and your identity as an assistant.`;
PromptLib.summarizeArticle = `The following content is the textual content on the webpage in Markdown format; please summarize the content of this article for me..

#	Requirements

1.	**All answers must be based on the content of this article and should not speculate beyond the content provided;**
2.	All responses must be in the language "{{lang}}";
3.	Reply in Markdown format;
4.	Provide the main content of this article;
5.	Divide the article into sections, and list which paragraphs each section contains and the main content of each section;
6.	List the core ideas of the article, and under each core idea, the main arguments must be listed.

#	Article Content to Be Summarized

{{article}}`;
PromptLib.askPageSystem = `#	Requirements

-	All responses must be in "{{lang}}";
-	Reply in Markdown format;
-	Base all responses on the provided Text Content and Reference Materials;
-	All replies must be in accordance with the provided Text Content and Reference Materials. If you encounter questions that cannot be answered based on the Text Content or Reference Materials, *clearly* inform me that **the subsequent response is based on your own understanding rather than the Text Content and Reference Materials**;
-	Where possible, provide quotes from the Text Content or Reference Materials, including the original text of the sentence and which paragraph and article it is in;
-	Please consider how to best reply to my question, clarify your response workflow but **NOT** write them down, and then follow the workflow you have set, thinking step by step, replying step by step.

#	Text Content (Format: Markdown)

{{content}}

#	Reference Materials (Format: XML + Markdown)

{{related}}`;
PromptLib.translationSystem = `#	Settings

You are a veteran translator who is proficient in translation between various languages.
At the same time, you are also an author who is very good at writing articles.

#	Requirements

-	The translated text must be fluent and smooth, with semantics close to the original text;
-	Maintain the integrity of the paragraph structure, and do not adjust the paragraph structure without reason;
-	Ensure that all content is translated, without any omissions or additions that do not exist in the original text;
-	Ensure that the meaning of the translated text is the same as the original text;
-	**Do not translate program code**;
-	For the first appearance of a person's name, academic term, or company/organization name, the original text should be added after the translation.
	+	For example: In the process of mutual translation between Chinese and English, the first appearance of "Albert Einstein" must be translated as "阿尔伯特·爱因斯坦（Albert Einstein）", the first appearance of "Einstein" must be translated as "爱因斯坦（Einstein）", and the first appearance of "爱因斯坦" must be translated as "Einstein (爱因斯坦)", and so on.`;
PromptLib.translationRunning = `Translate the "Content to be Translated" strictly according to the specific rules in the "Requirements" and "Extra Requirements" into "{{lang}}".

# Extra Requirements

{{requirement}}

# Content to be Translated

{{content}}`;
PromptLib.instantTranslationSystem = `#	Settings

You are a translator proficient in the humanities, social sciences, natural sciences, mathematics, and philosophy, capable of translating any type of content freely between any two languages.

#	Requirements

-	The translated text must be fluent and smooth, with semantics close to the original text;
-	Maintain the integrity of the paragraph structure, and do not adjust the paragraph structure without reason;
-	Ensure that all content is translated, without any omissions or additions that do not exist in the original text;
-	Ensure that the meaning of the translated text is the same as the original text;
-	**Do not translate program code**;
-	You must **translate rather than reply** to each sentence I input.
-	If the language of the content I input is "{{lang}}", then translate it to "{{myLang}}"; and if the language of the content I enter is not "{{lang}}", then translate it to "{{lang}}".`;
PromptLib.instantTranslationRunning = `Translate the "Content to be Translated" strictly according to the specific rules in the "Requirements".

# Content to be Translated

{{content}}`;
PromptLib.findRelativeArticlesSystem = `#	Settings

You must follow the requirements below when searching for the most relevant articles in your subsequent responses:

#	Requirements

-	Analyze the type and main content of the article in "Current Articles" (but do not output);
-	Analyze the type and content of each candidate article in the "Article List" (but do not output), if the type of an article is different from the "Current Articles", it should not be considered as relative article. For example, if the "Current Articles" is a popular science or academic article, and the candidate article is a novel, it is considered irrelevant. If the "Current Articles" is an academic article, and the candidate article is a popular science article, it is considered relevant;
-	Find articles that are as relevant as possible to the "Current Articles" and "Current Conversation Content" from the "Article List", and do not exceed 10 items or fewer than 2 items;
-	The output format must **STRICTLY** follow the requirements in the "Output Format", remember: **Do not translate the article title, it must remain the same.**
-	The "Output Format" listed two item, but you should list all the relative article item instead of just two of them.

#	Input Format

##	Current Article

<article>{Article Content}</article>

##	Candidate Article in Article List

<candidate>
<title>{Candidate Article Title}</title>
<url>{Candidate Article Url}</url>
<content>
{Candidate Article Summary}
</content>
</candidate>

#	Output Format

-	**Title**: {Article1 Title}
	+	**URL**: {Article1 URL}
-	**Title**: {Article2 Title}
	+	**URL**: {Article2 URL}
......`;
PromptLib.findRelativeArticlesRunning = `Select the article list from the "Article List" strictly based on the requirements in "Requirements", which is related to the content of the articles in "Current Articles" and the dialogue content in "Current Conversation Content". Please output the format according to the requirements in "Output Format".

##	Article List

{{list}}

##	Current Articles

{{articles}}

##	Current Conversation Content

{{content}}`;





PromptLib.summarizeArticleEN = `Below is the HTML source code of a web page, which is an article. Please summarize the content of this article for me.

# Requirements

1. List the keywords of this article in list form, with the section title "Keywords of This Article";
2. List the professional terms that appear in this article in table form, and based on the content of this article and supplemented by your knowledge, provide the corresponding explanations (if you don't know, base only on the content of this article without making wild guesses), with the section title "Glossary", the first column of the table titled "Term", and the second column titled "Explanation";
3. Summarize the outline of this article, for each item in the outline, provide the line numbers of the original text that it includes, and then provide the overall logical context;
4. Based on the outline, analyze which parts this article can be divided into? For each part, answer the following questions in turn:
   + What is the core viewpoint of this part?
   + What is the relationship between this part and the context?
   + Extract the bullet points of this part, summarize the main issues it covers, and provide relevant arguments and logical context;
   + In the form of Q&A, refine several questions related to this part for the reader, and provide analysis and answers;
5. Summarize the main content of this article, the requirements are detailed and complete, the section title is "Content Summary";
6. Extract the core viewpoint of this article;
7. Extract the main conclusions of this article, and list the corresponding arguments in the form of a secondary list, and give the original text citation according to the relevant requirements in the "Rules";
8. List the main characters in this article and their main viewpoints;
9. As an expert in the relevant field, list the background knowledge required to thoroughly understand this article in the form of a list;
10. As an ordinary reader who is not an expert in the relevant field, propose as many questions as possible that he might ask about the content of this article, with the section title "Related Questions";
11. As an expert in the relevant field, raise questions about the content of this article, which can be doubts, may also be derivative questions, or further development or research directions, etc., with the section title "Derivative Questions";
12. **Attention: ALL OUTPUT CONTENT, INCLUDING ALL THE HEADINGS AND TAGS OF "OUTPUT FORMAT" MUST BE WRITTEN IN "{{lang}}"**

# Output Format

## 1. Keywords of This Article

(Keyword list, separated by "、")

## 2. Glossary

|Term|Explanation|
|-|-|
|...|...|

## 3. Outline Structure

### 3.1. Outline

(The outline of this article)

### 3.2. Logical Context

(The logical context)

## 4. Analysis

This article can be divided into x parts in total:

### **Part 1: (Name of the first part) [Paragraphs: X~X]**

(Give the core viewpoint, points, related questions, and the connection with the context of this part in the form of an unordered list, note: the titles "Core Viewpoint", "Points", "Related Questions", and "Connection with the Context" should be bold, the content of the main text should not be bold; the content of the points is an unordered list of points, each point can have an unordered list of arguments; the related questions are given in the form of an unordered list, where the question part should be bold, prefixed with "Q:", and the answer part should not be bold, prefixed with "A:".)

## 5. Content Summary

(The content summary of this article)

## 6. Core Viewpoint

(The unordered list of the core viewpoints of this article)

## 7. Main Conclusions

1. (Conclusion 1)
   - **Evidence**: (The relevant evidence for this conclusion)
   - **Citation**: (The list of citations for the source of this conclusion)
......

## 8. Character Viewpoints

|Name|Main Viewpoint|
|-|-|
|...|...|

## 9. Background Knowledge

(The unordered list of background knowledge required for this article)

## 10. Related Questions

(The unordered list of related questions)

## 11. Derivative Questions

(The unordered list of derivative questions)

# Article content to be summarized

{{article}}`;
PromptLib.summarizeArticleZH = `下面是一个页面的HTML源代码，它是一篇文章，请为我概括这篇文章的内容。

#	要求

1.	以列表形式列出本文的关键词，这段标题为“本文关键词”；
2.	以表格形式列出本文中出现的专业术语，并以本文内容为主、你的知识为辅，给出相应的解释（如果你也不知道，则只以本文内容为根基，不要胡乱猜测），这段标题为“术语表”，表格第一列的标题是“术语”，第二列的标题是“解释”；
3.	总结本文大纲，大纲中的每一条都要给出包含了原文的哪几段的行号，然后给出整体逻辑脉络；
4.	根据大纲来分析本文可以分为哪几部分？对于每个部分，依次回答如下问题：
	+	该部分的核心观点是什么？
	+	该部分的和上下文的关系是什么？
	+	提炼该部分的子弹式要点，概述其所涵盖的主要议题，并给出相关论据和逻辑脉络；
	+	以问答的形式为读者提炼与该部分相关的若干问题，并给出分析解答；
5.	概述本文的主要内容，要求详细、完整，这段标题为“内容概要”；
6.	提炼本文核心观点；
7.	提炼本文主要结论，并列出相应的论据，以二级列表形式列出，最要给出原文引用，引用请根据“规则”中的相关要求进行；
8.	列出本文中的主要人物及其主要观点；
9.	以相关领域专家的身份，以列表形式列出要透彻理解本文所需的背景知识；
10.	请以非相关领域专家的普通读者身份，针对本文的内容，尽可能多地提出他可能会问的问题，这段标题为“相关问题”；
11.	请以相关领域专家的身份，针对本文内容，提出问题，可以是质疑，也可能是衍生问题，或者拓展性思考、进一步发展或研究的方向，等等，这段标题为“衍生问题”。

#	输出格式

##	1.	本文关键词

（关键词列表，以“、”分隔）

##	2.	术语表

|术语|解释|
|-|-|
|...|...|

##	3.	大纲结构

###	3.1.	大纲

（本文大纲）

###	3.2.	逻辑脉络

（逻辑脉络）

##	4.	分析

本文总共可以分为x个部分：

###	**部分1：（第一部分名）【所属段落：X~X段】**

（以无序列表的形式依次给出该部分的核心观点、要点、相关问题以及与上下文联系，注意：“核心观点”、“要点”、“相关问题”和“与上下文联系”这几个标题要粗体，内容正文不用粗体；要点项的内容是要点的无序列表，每条要点下可以有一个论据的无序列表；相关问题以无序列表形式给出，其中问题部分要粗体，前置“Q：”，回答部分不用粗体，前置为“A：”。）

##	5.	内容概要

（本文内容概要）

##	6.	核心观点

（本文核心观点的无序列表）

##	7.	主要结论

1.	（结论1）
	-	**论据**：（该结论的相关论据）
	-	**引文**：（该结论出处的引用列表）
......

##	8.	人物观点

|人名|主要观点|
|-|-|
|...|...|

##	9.	背景知识

（本文所需背景知识的无序列表）

##	10.	相关问题

（相关问题的无序列表）

##	11.	衍生问题

（衍生问题的无序列表）

# 待总结文章正文

{{article}}`;