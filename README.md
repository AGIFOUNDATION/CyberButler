#	CyberButler

> -	Author: LostAbaddon
> -	Version: 0.3.3

Your Personal cyber knowledge vault butler.

---

$$
E = M \times c^2
$$

-	E: Enlightment
-	M: Mind
-	c: cyberbutler

---

##	How to Use

###	Configuration Settings

When you use this plugin for the first time, a basic information settings page will pop up. You can also choose to click the plugin's Action button to bring up the settings page.

On the settings page, you can fill in your basic information, including your name, personal introduction, and preferred language. You can also set the URL of the local knowledge base server and the APIKey of each AI platform used by the front end.

**Rest assured: the front end will not disclose your APIKey when calling AI, and when connecting to our official local knowledge base, the knowledge base will not disclose your personal information or APIKey.** However, please ensure that the local knowledge base you connect to is from an official source.

Currently, the front end can connect to the following AI platforms:

-	Gemini (1.5 flash, 1.5 pro)
-	OpenAI (GPT-4o, GPT-4Turbo)
-	Anthropic (Claude 3 Opus, 3.5 Sonnet, 3 Haiku)
-	MoonShot (MoonShot-v1-128k)
-	DeepSeek (DeepSeek Chat, DeepSeek Coder)

###	Feature Introduction

This plugin will judge the type of page you are currently browsing and automatically remind you of the operations you can perform. You can also click the plugin's Action button or use the shortcut key (Ctrl + Y) to manually call it.

In addition, you can also use the right-click menu to summon the plugin. The right-click menu has three modes:

1.	Normal mode: This mode menu is enabled when there is no selected content on the page and you are not in the input box;
2.	Translation mode: This mode menu is enabled when there is selected content on the page and you are not in the input box. You can directly translate the highlighted text;
3.	Writing mode: This mode menu is enabled when you are in the input box. You can directly optimize your input (under development).

####	Overview and Summary

This plugin can summarize the content of the current page. You can also interact with AI directly based on the content of the current page (click the button in the upper right corner to bring up the communication interface).

In addition, this plugin will use relevance retrieval mechMechanism to automatically load other pages that you have previously summarized using this plugin and are related to the current page and the current dialogue content during your interaction with it. It will combine the content of these pages to provide richer and more detailed responses.

Your chat history with Cyprite will be saved for 12 hours. If there is no further dialogue within 12 hours, the chat history will be automatically cleared. You can also manually clear the chat history on the current page by clicking the button.

####	Translation

This plugin can translate the content of the current page or translate the part you have highlighted. You can get a better translation by entering further translation requirements (in the input box below the main translation interface) and letting AI re-translate for you. Make good use of this function!

At the same time, you can also translate with AI in real time (click the button in the upper right corner to bring up the real-time translation interface): if the content you enter is in the target language, AI will translate it into your currently set daily language; if the content you enter is not in the target language, AI will translate it into the target language.

####	Other

The plugin will remember all the web pages you have interacted with and load the historical pages related to the current chat topic when communicating with you, providing comprehensive interaction based on all these pages. Of course, you can also choose to manually add or delete these pages to limit the scope of interaction to areas that you are more interested in.

When using the local knowledge base, the plugin will load local information through the server and use the local files and the web pages you have browsed as the current knowledge base for question and answer interaction during the interaction process.

##	 Other Potential

1.	Automatic Writing and Polishing
2.	Cross-Page Comprehensive Question Answering
3.	AI Search
4.	Powerful Backend Knowledge Base