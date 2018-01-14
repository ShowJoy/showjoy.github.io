## 准备
* 工具： [Atom](https://atom.io/)
* 语法：[ES6](http://es6.ruanyifeng.com/)

## 基础知识
在开始编写插件之前，了解一些基本的atom知识是必要的。这是我根据官方文档加自己在开发过程中的一些理解的归纳，没有包含所有的细节，但在稍微复杂点的插件中基本都会用到的。

### 1、生成一个插件
atom生成插件很简单，打开命令面板（cmd+shift+p）输入“Generate Package”，将出现一个对话框，输入你将要建立的包名字，回车即可。atom会自动创建一个一刚输入的包名字命名的文件夹，里面包含了默认生成的文件，默认的位置在`~/atom/package`中，其目录结构如下：

	my-package
		├─ keymaps/
		├─ lib/
		├─ menus/
		├─ spec/
		├─ styles/
		└─ package.json
其实，基本的路径结构还包括snippets和grammars目录，下面实战中将会用到snippets，存放自定义的代码段文件。

#### keymaps
我们可以为插件自定义快捷键，形如上面创建包的`kemaps/my-package.json`文件中定义：

	{
		"atom-workspace": {
    		"ctrl-alt-o": "my-package:toggle"
		}
	}
这样，我们在键盘上按`ctrl-alt-o`就会执行命令`my-package:toggle`, 其中`atom-workspace`的位置是设置快捷键起作用范围，这里`atom-workspace`元素是Atom UI的父级，所以只要在工作区域按快捷键就可触发命令。如果定义`atom-text-editor`，那么就只能在编辑区域触发命令。[了解更多](http://flight-manual.atom.io/behind-atom/sections/keymaps-in-depth/)

#### lib
该目录下是主要是实现插件功能的代码，并且必须包含插件的主入口文件（其将在`package.json`的main字段指定。如不指定，默认lib下的`index.js`或`index.coffee`文件）, 主入口文件可以实现以下基本方法：

* config: 该对象中可以为包自定义配置。
* activate(state)：该方法是在包激活的时候调用。如果你的包实现了`serialize()`方法，那么将会传递上次窗口序列化的state数据给该方法
* initialize(state)：(Atom 1.14以上版本可用) 类似于activate(), 但在它之前调用。`intialize()`是在你的发序列化器或视图构建之前调用，`activate()`是在工作区环境都已经准备后调用。
* serialize()：窗口关闭后调用，允许返回一个组件状态的JSON对象。当你下次窗口启动时传递给`activate()`方法。
* deactivate()：当窗口关闭时调用。如果包正在使用某些文件或其他外部资源，将在这里释放它们。


#### styles
`styles`目录下存放的是包的样式文件。可以使用css或less编写。

#### snippets
`snippets`目录下存放的是包含常用的代码段文件，这样就可以通过输入缩写前缀快速生成常用的代码语法，实战中将会详细讲解。

#### menus
该目录下存放的是创建应用菜单和编辑区域菜单文件。形如：

	{
		"context-menu": {
    		"atom-text-editor": [{
        		"label": "Toggle my-package",
        		"command": "my-package:toggle"
      		}]
      	},
      	"menu": [{
	      	"label": "Packages",
    	  	"submenu": [{
          		"label": "my-package",
          		"submenu": [{
            	  	"label": "Toggle",
              		"command": "my-package:toggle"
            	}]
        	}]
    	}]
	}

`context-menu`字段定义的上下文菜单，通过在你定义的元素（示例中是`atom-text-editor`字段）范围内点击右键呼出菜单栏，点击`Toggle my-package`会执行`my-package:toggle`命令。

`menu`字段定义应用的菜单，其出现在atom主菜单栏中，定义类似`context-menu`。

### 2、配置
为了让开发的包可配置化，atom为我们提供了Configuration API。

`atom.config.set`方法为包写入配置。

`atom.config.setSchema`方法为包写入配置schema, 下面示例demo中定了一个type为
`string`, 枚举类型的schema。[了解更多](https://atom.io/docs/api/v1.18.0/Config)

`atom.config.get`方法读取包配置。

下面是一些demo:


	const versionSchema = {
    	title: 'Element Version',
    	description: 'Document version of Element UI.',
     	type: 'string',
      	default: '1.3',
      	enum: ['1.1', '1.2', '1.3'],
      	order: 1
    };
    // 设置配置schema
    atom.config.setSchema('element-helper.element_version', versionSchema);
    
    // 修改配置的element-helper.element_version值为1.2
    atom.config.set('element-helper.element_version', '1.2');
    
    // 获取配置element-helper.element_version
    atom.config.get('element-helper.element_version'); // 1.2

为了监听config的变化atom提供了`observe`和`onDidChange`两个方法。
前者会在指定keypath的值时立即调用它的回调函数，以后改变也会调用。后者则是在keypath下次改变后调用它的回调函数。使用demo如下：

	atom.config.observe('element-helper.element_version', (newValu) => {
		console.log(newValue);
	});
	
	atom.config.onDidChange('element-helper.element_version', (event) => {
		console.log(event.newValue, event.oldValue);
	});
### 3、作用域
atom中的作用域是一个很重要的概念，类似于css的class，通过作用域的名称来选择操作作用的范围。打开一个vue文件，按`alt+cmd+i`打开开发者工具，切换到Elements选项。会看到类似如下的HTML结构:
![scope.png](https://user-images.githubusercontent.com/1659577/27771250-9b23c600-5f7d-11e7-87e7-98d0d3e5de41.png)
图上span元素的class的值就是作用域名称。那怎么来利用作用域名称来选择作用范围呢？比如要选择vue中所有元素标签名称作用范围。其实就像css选择器一样，如'text.html.vue .entity.name.tag.other.html', 选择vue中所有标签名称节点，注意这里是不要加yntax--前缀的，atom内部会处理。其可用到snippets, config等需要限定作用范围的功能中。[了解更多](https://atom.io/docs/api/v1.18.0/ScopeDescriptor)
### 4、package.json
类似于Node modules, Atom包也包含一个package.json文件，但是Atom拥有自己定义的字段，如main指定包的主入口文件；activationCommands指定那些命令可以激活入口文件中activate方法；menus, styles, keymaps, snippets分别指定目录，样式，快键键映射，代码段的文件加载位置和顺序。[了解更多](http://flight-manual.atom.io/hacking-atom/sections/package-word-count/#packagejson)

### 5、与其他包交互
可以在`package.json`中指定一个或多个版本号的外包来为自己提供服务。如：

	"providedServices": {
    	"autocomplete.provider": {
      		"versions": {
        		"2.0.0": "provide"
      		}
    	}
    }

这里使用`autocomplete+`包提供的`provide`API，版本是`2.0.0`。这样只要在package.json中main字段指定的主文件中实现provide方法（如下），就可以在包激活的任何时候调用。如：
	
	export default {
		activate(state) {}
	
		provide() {
    		return yourProviderHere;
    	}
    }

## 实战
经过简单的基础知识的介绍，接下来我们通过实战来运用这些知识，深入了解其原理和工作机制。下面实战是以[ELement-helper](https://github.com/ElemeFE/element-helper)插件为例。

### 1、自动补全
这里通过使用[autocomplete+](https://github.com/atom/autocomplete-plus)提供的服务（[Provide API](https://github.com/atom/autocomplete-plus/wiki/Provider-API)）来实现自动补全功能。关于怎么建立交互请看基础知识中的第5小节，那么我们要实现的就是定义自己的`yourProiverHere`， 它是一个对象包含如下示例中的方法：

	const provider = {
		// 选择器，指定工作的作用域范围，这里是只有在选择器'.text.html'作用域下才能工作, 如html文件有作用域'.text.html.basic', vue文件有作用域'.text.html.vue'都是包含于'.text.html'的
		selector: '.text.html',
		// 排除工作作用域中子作用域，如html,vue文件中的注释。可选
		disableForSelector: '.text.html .comment',
		// 表示提示建议显示优先级， 数字越高优先级越高，默认优先级是0。可选
		inclusionPriority: 1,
		// 如果为true，那么根据inclusionPriority大小，高优先级就会阻止其他低优先级的建议服务提供者。可选
		excludeLowerPriority: true,
		// 在提示下拉选项中的排序, 默认为1，数字越高越靠前。可选
		suggestionPriority: 2
		
		// 返回一个promise对象、包含提示的数组或者null。这里返回提示列表给autocomplete+提供的服务展示，我们不用关心如何展示
		getSuggestions(request) {
			// todo
			return [];
		},
		// provide提供的建议（即getSuggetion方法返回的提示）插入到缓冲区时被调用。可选
		onDidInsertSuggestion({editor, triggerPosition, suggestion}) {
    		// todo
    	},
    	// provider销毁后的善后工作，可选
    	dispose() {
    		// todo
    	}
    }
 重点介绍下getSuggestion的参数request对象，它包含下面属性：
 
 * editor： 当前的[文本编辑上下文](https://atom.io/docs/api/v1.18.0/TextEditor)
 * bufferPosition：当前光标的[位置](https://atom.io/docs/api/v1.18.0/Point)，包含属性row和column。
 * scopeDescriptor: 当前光标位置所在的作用域描述符，可通过其`.getScopesArray`方法获取到包含所有自己和祖先作用域选择器的数组。你可以通过按`cmd+shift+p`打开命令面板输入`Log Cursor scope`来查看作用描述符。
 * prefix：当前光标输入位置所在单词的前缀，注意autocomplete+不会捕获‘<‘,’@’和 ':'字符，所以后面我们得自己做处理。原来没有仔细阅读文档（衰），我发现我原来实现的方法比较局限，其实这里教你怎么定义[自己的prefix](https://github.com/atom/autocomplete-plus/wiki/Provider-API#generating-a-new-prefix)了
 * activateManually：这个提示是否是用户[手动触发](http://flight-manual.atom.io/using-atom/sections/autocomplete/)
 
 介绍完API了，是时候来一起小试牛刀了。这里就以[ELement UI](http://element.eleme.io/#/zh-CN/component/button)标签的属性值的自动提示为例:
![attrvalue](https://user-images.githubusercontent.com/1659577/28152214-ec63264e-67d1-11e7-850d-e2ad569aa2c5.gif)
 autocomplete+提供的provider会在用户包激活后任何时候调用（比如输入字符），我们只需在getSuggestion方法中返回提示信息（建议）数组就好了。那么问题重点来了，怎么获取这个提示信息数组？观察示例，想一想，可以分两大部分：判断提示出现的时机和过滤出提示信息数组。
##### 1、判断提示出现时机
示例中的时机是是否是标签属性值开始（`isAttrValueStart`），我们先实现三个方法：是否在字符串作用域范围内（`hasStringScope`）、是否在标签作用域范围内（`hasTagScope`）和输入字符位置前是否具有属性名称（`getPreAttr`）：
	
	// scopes是否包含单引号和双引号作用域选择器来决定是否在字符串中
	function hasStringScope(scopes) {
    	return (scopes.includes('string.quoted.double.html') ||
      		scopes.includes('string.quoted.single.html'));
    }
    
	// scopes是否存在标签（tag）的作用域选择器来决定是否在标签作用域内，这里也是存在多种tag作用域选择器
	function hasTagScope(scopes) {
    	return (scopes.includes('meta.tag.any.html') ||
      	scopes.includes('meta.tag.other.html') ||
      	scopes.includes('meta.tag.block.any.html') ||
      	scopes.includes('meta.tag.inline.any.html') ||
      	scopes.includes('meta.tag.structure.any.html'));
	}
	// 获取当前输入位置存在的属性名
	function getPreAttr(editor, bufferPosition) {
		// 初始引号的位置
    	let quoteIndex = bufferPosition.column - 1;
    	// 引号的作用域描述符
    	let preScopeDescriptor = null;
    	// 引号的作用域描述符字符串数组
    	let scopes = null;
    	// 在当前行循环知道找到引号或索引为0
    	while (quoteIndex) {
    		// 获取位置的作用描述符
      		preScopeDescriptor = editor.scopeDescriptorForBufferPosition([bufferPosition.row, quoteIndex]);
	     	scopes = preScopeDescriptor.getScopesArray();
	     	// 当前位置不在字符串作用域内或为引号起始位置， 则跳出循环
      		if (!this.hasStringScope(scopes) || scopes.includes('punctuation.definition.string.begin.html')) {
        		break;
      		}
      		quoteIndex--;
    	}
    	// 属性名匹配正则表达
		let attrReg = /\s+[:@]*([a-zA-Z][-a-zA-Z]*)\s*=\s*$/;
		// 正则匹配当前行引号之前的文本
    	let attr = attrReg.exec(editor.getTextInBufferRange([[bufferPosition.row, 0], [bufferPosition.row, quoteIndex]]));
    	return attr && attr[1];
	}
	
说明：

1. 参数scopes是前面讲的作用域描述符，可以打开命令面板输入`Log Cursor scope`来查看。
2. scopeDescriptorForBufferPosition方法是获取给定位置的作用域描述符，具体请查看[这里](https://atom.io/docs/api/v1.18.0/ScopeDescriptor)。
3. getTextInBufferRange)方法是根据位置范围（[Range](https://atom.io/docs/api/v1.18.0/Range)）获取文本字符串，具体请查看[这里](https://atom.io/docs/api/v1.18.0/TextEditor#instance-getTextInBufferRange), 他有个别称getTextInRange（官方文档里是没有的可以查看源代码[L1024](https://github.com/atom/atom/blob/v1.18.0/src/text-editor.coffee#L1024)和[L931](https://github.com/atom/atom/blob/v1.18.0/src/text-editor.coffee#L931)，实现一毛一样）。

那么接下来就来实现`isAttrValueStart`方法：
	
	// 参数解释请看 ‘自动补全’ 小节
	function isAttrValueStart({scopeDescriptor, bufferPosition, editor}) {
		// 获取作用域描述符字符串数组， 形如['text.html.vue', 'meta.tag.other.html', 'string.quoted.double.html', 'punctuation.definition.string.end.html']
    	const scopes = scopeDescriptor.getScopesArray();
		// 获取当前位置的前一个字符位置
	    const preBufferPosition = [bufferPosition.row, Math.max(0, bufferPosition.column - 1)];
	    // 获取前一个字符位置的作用域描述符
    	const preScopeDescriptor = editor.scopeDescriptorForBufferPosition(preBufferPosition);
    	// 获取作用域描述符字符串数组
    	const preScopes = preScopeDescriptor.getScopesArray();
		
		// 当前鼠标位置 and 前一个位置（这个里主要是判断'attr='再输入'或"这种情况）是包含在字符串作用域中 and 前一个字符不能是字符串定义结束字符（' or "）为真，就说明是开始输入属性值
	    return (this.hasStringScope(scopes) &&
    		this.hasStringScope(preScopes) &&
     		!preScopes.includes('punctuation.definition.string.end.html') &&
      		this.hasTagScope(scopes) &&
      		this.getPreAttr(editor, bufferPosition));
    }
  
##### 2、过滤出提示信息数组
前面已经判断提示信息出现的时机，剩下就是如何展示相应标签属性的值了， 这真是个精细化工作。惯例，先做些准备工作：1.获取输入位置所在的标签名（`getPreTag`）; 2.获取输入位置所在的属性名（`getPreAttr`） - 这个上小节已实现；3.既然知道标签名和属性名，那么就可以从事先纯手工打造的`attributes.json`文件(具体请看[element-helper-json](https://github.com/ElementUI/element-helper-json))中找到对应的属性值了（`getAttrValues`）- 这个就是遍历json对象属性，不具体解释。
	
	// 标签名匹配正则表达式 - 标签匹配有很多情况，这存在些bug。。。，这里仅供参考。
	let tagReg = /<([-\w]*)(?:\s|$)/;
	// 参数请查看上面getSuggestion参数对象属性解析
	function getPreTag(editor, bufferPosition) {
		// 当前行
    	let row = bufferPosition.row;
    	// 标签名
    	let tag = null;
    	// 文件逐行向上遍历知道找到正则匹配的字符串，或row = 0;
    	while (row) {
    		// lineTextForBufferRow 获取当前行文本字符串
      		tag = tagReg.exec(editor.lineTextForBufferRow(row));
      		if (tag && tag[1]) {
        		return tag[1];
      		}
      		row--;
    	}
    	return;
    }
OK，准备工作好了，我们来对获取到的属性值数组进行格式化处理，获得getSuggestions能识别的数据结构数组：
	
	function getAttrValueSuggestion({editor, bufferPosition, prefix}) {
    	// 存放提示信息对象数据
    	const suggestions = [];
    	// 获取当前所在标签名
    	const tag = this.getPreTag(editor, bufferPosition);
    	// 获取当前所在属性名称
    	const attr = this.getPreAttr(editor, bufferPosition);
    	// 获取当前所在标签属性名下的属性值
    	const values = this.getAttrValues(tag, attr);
    	// 属性值数组进行格式化处理
    	values.forEach(value => {
      		if (this.firstCharsEqual(value, prefix) || !prefix) {
        		suggestions.push(buildAttrValueSuggestion(tag, attr, value));
      		}
    	});
		// 返回符合autocompete+服务解析的数据结构数组
    	return suggestions;
    }
    // 对原始数据加工处理
    function buildAttrValueSuggestion(tag, attr, value) {
    	// ATTRS 是attributes.json文件解析出的json对象
    	const attrItem = ATTRS[`${tag}/${attr}`] || ATTRS[attr];
    	// 返回suggestion对象 具体格式说明请看:https://github.com/atom/autocomplete-plus/wiki/Provider-API#suggestions
    	return {
      		text: value,          // 插入文本编辑器，替换prefix
      		type: 'value',        // 提示类型，用于列表提示左边的icon展示，有变量（varabale）, 方法（method）和函数（function）等可选
      		description: attrItem.description, // 用于选中提示条目后，提示框下面展示的信息
      		rightLabel: attrItem.global ? 'element-ui' : `<${tag}>`  // 右边展示的文本信息
    	};
	}
经过以上两步，只需在getSuggestions返回数组给autocomplete+服务即可:
	
	// ...
	getSuggestions(request) {
    	if (this.isAttrValueStart(request)) {
      		return this.getAttrValueSuggestion(request);
		}
	}
	// ...
到这里大家应该明白自动补全工作原理了吧，其他的可以依葫芦画瓢啦。
### 2、代码段
定义代码段的方式有三种方式:

* 全局定义。在Atom->Snippets菜单中定义，定义方式同第二种
* 包内定义。在基础知识部分，我们介绍了生成包后的文件目录结构和作用，其中snippets文件夹里放的就是我们自定义的常用代码块json文件，这里我使用为coffeescript对象提供的[cson](https://github.com/bevry/cson)文件，类似json，但语法没有那么严格且支持多行字符串，如官网介绍：
> Which is far more lenient than JSON, way nicer to write and read, no need to quote and escape everything, has comments and readable multi-line strings, and won't fail if you forget a comma.

现在来看下如何编写一个代码段，基本格式如下：
	
	".source.js":
		"notification":
      		"prefix": "notify",
      		"body": """
      			this.$notify({
        			title: '${1:title}',
        			message: '${2:string|VNode}'
      			});
      		"""
最顶层的键字符串（`.source.js`）是作用域选择器，指定在文本编辑器中那个范围内可触发匹配(示例中是在js文件或script标签域中触发代码段匹配)。下一层键字符串（`notification`）是表示代码段的描述，将展示在下拉条目的右边文本；prefix字段是匹配输入字符的前缀；body字段是插入的文本，可以通过"""来使用多行语法，body中`$`符表示占位符，每按一次tab键，都会按`${num}`中的num顺序移动位置。如果要在占位符位置填充字符的话，可以这样`${num: yourString}`。示例效果如下：[了解更多](http://flight-manual.atom.io/using-atom/sections/snippets/#creating-your-own-snippets)
![snippet](https://user-images.githubusercontent.com/1659577/28159375-4f0315f8-67ef-11e7-9b49-f859d0fe1623.gif)

* 在‘自动补全’小节中可以返回snippet的提示，只需在suggestion对象中定义snippet和displayText属性即可,不要定义text属性。snippet语法同基本格式中body, displayText用于提示展示文本。

### 3、创建一个modal下拉列表和文档视图
ATOM为实现这两个功能提供了npm包[atom-space-pen-views](https://www.npmjs.com/package/atom-space-pen-views)，它包括三个视图类：文本编辑器视图类（[TextEditorView](https://github.com/atom/atom-space-pen-views#texteditorview)）、滚动文档视图类（[ScrollView](https://github.com/atom/atom-space-pen-views#scrollview)）和下拉选项视图类（[SelectListView](https://github.com/atom/atom-space-pen-views#selectlistview)），我们只需继承视图类，实现类方法即可。下面重点讲下拉列表和滚动视图类：

##### 模态下拉列表
我们只要提供用于展示的条目给SelectListView，实现两个必选方法，它会帮我们的条目渲染成一个下拉列表形式，如下:
	
	// file: search-veiw.js 
	import { SelectListView } from 'atom-space-pen-views';
	
	class SearchView extends SelectListView {
		// keyword：用于初始化列表搜索框值，items：用于展示列表的条目数组，eg: [{name: 'el-button'}, {name: 'el-alert'}]
		constructor(keyword, items) {
			super();  // 执行SelectListView的构造函数
			// ATOM API：addModalPanel(options), 添加一个模态框, item是用于模块框展示的DOM元素，JQuery元素或实现veiw model
			this.panel = atom.workspace.addModalPanel({item: this});
			
			// 给下拉列表搜索框写入文本
			this.filterEditorView.setText(keyword);
			// 下拉列表可展示条目的最大数目
			this.setMaxItems(50);
			// 设置用于展示的下拉条目数组 
			this.setItems(items);
			// 鼠标焦距到列表搜索框
			this.focusFilterEditor();
		}
		// 必须实现。自定义列表条目展示视图，该方法会在setItems(items)中单条item插入到下拉列表视图时调用
		veiwForItem(item) {
			return `<li>${item.name}</li>`;
		}
		// 必须实现。 当下拉列表条目被选中后触发，参数item为选中条目对象
		confirmed(item) {
			// todo
			this.cancel(); // 选中后关闭视图
		}
		// 当列表视图关闭后调用
		cancelled () {
			// todo
		}
		// 搜索框输入值，按item对象哪个键值模糊匹配，eg: item.name
		getFilterKey() {
			return 'name'
		}
	}
	export default SearchView;
视图效果和DOM树结构如下图，我们可以看到通过addModalPanel把selectList的html元素添加到模态框元素中了
![image](https://user-images.githubusercontent.com/1659577/28235961-24f8975c-694c-11e7-9491-efac2a5f2490.png)

定义好了视图类，可以在主文件activate方法中注册命令来触发视图展示：
	
	import SearchView from './search-view.js';
	
	export default {
		activate() {
			// 实例化一个销毁容器，便于清除订阅到atom系统的事件
			this.subscriptions = new CompositeDisposable();
			// 这里需在keymaps目录下的文件中配置keymap.
    		this.subscriptions.add(atom.commands.add('atom-workspace', {
      			'element-helper:search': () => {
      				// 获取当前正在编辑（活跃）的文本编辑器
      				if (editor = atom.workspace.getActiveTextEditor()) {
      					// 获取你光标选中的文本
      					const selectedText = editor.getSelectedText();
      					// 获取光标下的单词字符串
      					const wordUnderCursor = editor.getWordUnderCursor({ includeNonWordCharacters: false });
						// 用于下拉列表展示的数据， 这里只是个demo
      					const items = [{
     						"type": "basic",
      						"name": "Button 按钮",
      						"path": "button",
      						"tag": "el-button",
      						"description": "el-button,Button 按钮"
    					}];
    					// 没有范围选中文本，就用当前光标下的单词
      					const queryText = selectedText ? selectedText : wordUnderCursor;
						// 实例化搜索下拉列表视图
      					new SearchView(queryText, items);
    				}
      			}
    		}));
		}
	}
	
##### 文档视图
atom提供了打开一个空白文本编辑器的api([atom.workspace.open](https://atom.io/docs/api/v1.18.0/Workspace#instance-open))和注册uri打开钩子（opener）函数的api([atom.workspace.addOpener(opener)]())，那么再结合ScrollView可以打开一个可滚动的文档窗口。No BB, show my code:
	
	/**
	* file: doc-view.js
	* 继承ScrollView类， 实现自己的文档视图类
	*/
	import { Emitter, disposable } from 'atom';
	import { ScrollView } from 'atom-space-pen-views';
	
	class DocView extends ScrollView {
		
		// 视图html
		static content(){
			// this.div方法将会创建一个包含参数指定属性的div元素，可以换成其他html标签，eg: this.section()将创建section标签元素
			return this.div({class: 'yourClassName', otherAttributeName: 'value'});
		}
		
		constructor(uri) {
			super();
			// 实例化事件监听器，用于监听和触发事件
			this.emitter_ = new Emitter();
			// 文档标题，tab名称
    		this.title_ = 'Loading...';
    		this.pane_ = null;
    		this.uri_ = uri;
		}
		// 自定义方法，用户可自定义视图中展示的内容, 具体可查看Element-helper源码
		setView(args) {
			// todo, demo
			this.element.innerHTML = '<h1>Welcome to use Atom</h1>';
    		this.title_ = "Welcome!";
    		this.emitter_.emit('did-change-title');    		
		}
		
		// 当视图html插入文本编辑器后触发，注意view被激活后才会触发视图的插入
		attached() {
			// 这里可以在视图插入DOM后做些操作，比如监听事件，操作DOM等等
			// 通过atom.workspace.open打开文本编辑器的URI获取视图所在的窗口容器，看下图比较容易什么是窗口容器
			this.pane_ = atom.workspace.paneForURI(this.uri_);
    		this.pane_.activateItem(this);
		}
		
		// 文档标题被激活执行
		onDidChangeTitle(callback) {
			// 监听自定义事件
			return this.emitter_.on('did-change-title', callback);
		}
		// 文档视图关闭后销毁函数
		detory() {
			// 销毁文档视图
			this.pane_.destroyItem(this);
			// 如果当前窗口容器中只有文档视图，那么把容器都销毁掉
    		if (this.pane_.getItems().length === 0) {
      			this.pane_.destroy();
    		}
		}
		// 标题改变后触发事件did-change-title, callback内部将调用改方法
		getTitle {
			return this.title_;
		}
	}
![pane.png](https://user-images.githubusercontent.com/1659577/28240696-bfe0455a-69b8-11e7-93c8-b424d403f497.png)

	/**
	* 主文件, 这里只写activate函数里的关键代码
	*/
	import Url from 'url';
	import DocView from './doc-view.js';
	// ....
	// 初始化文档视图对象
	this.docView_  = null；
	// 便于测试沿用上面搜索命令，触发打开视图
	this.subscriptions.add(atom.commands.add('atom-workspace', {
		'element-helper:search': () => {
			  // 异步打开一个给定URI的资源或文本编辑器，URI定义请看：https://en.wikipedia.org/wiki/Uniform_Resource_Identifier, 参数split确定打开视图的位置，activatePane是否激活窗口容器
			  atom.workspace.open('element-docs://document-view', { split: 'right', activatePane: false})
	      		.then(docView => { // docView是经过addOpenert添加的钩子处理后视图对象，如果没有相应的opener返回数据，默认为文本编辑器对象（TextEditor）
        			this.docView_ = docView;
        			// 为docView填充内容，具体展示的内容请在DocView中定义的setView方法中操作
        			this.docView_.setView(yourArgments);
      			});
		}
	});
	// 为URI注册一个打开钩子，一旦WorkSpace::open打开URI资源，addOpener里面的方法就会将会执行
	this.subscriptions.add(atom.workspace.addOpener((url) => {
		if (Url.parse(url).protocol == 'element-docs:') {
      		return new DocView(url);
    	}
	}));
	// ...
如果还对这两个API有所疑虑，请查看上面提供的链接。那么最终效果如下：
![welcome.png](https://user-images.githubusercontent.com/1659577/28243786-e0e8166e-6a09-11e7-8f75-41c0bc79802a.png)
## 总结

这算是我在编写[Element-Helper](https://github.com/ElemeFE/element-helper)插件时的一些总结和过程吧，实现方式不一定完善或优雅，表述不清楚或错误的地方请留言指正。最后，希望本文能为大家提供一些帮助。Enjoy it！

