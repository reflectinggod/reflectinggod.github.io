//test user password

var data;
var sidebar;
var content;

var makeDataBold  = true;
var agreementIsCustom = false;
var sentAnonymousCustomTemplateUsage = false;
var sentAnonymousAgreementUsage = false;
var loadedObject;

$( document ).ready(function() 
{
	sidebar = $('#dataSidebar');
	content = $('#content');
	
	EnableTemplateFileInput();
});

function LoadDefaultAgreement()
{
	LoadFromServer('contracts/workforhire-en.json');
}

function LoadFromLocal(plainText)
{
	loadedObject = plainText;
	
	agreementIsCustom = true;
	
	content.html('<p style="margin-top: 30px;"><i class="fa fa-warning fa-2x"></i> There was an error loading your template file! If <a href="http://jsonformatter.curiousconcept.com/">validating</a> your template doesn\'t make it clear what the problem is, do <a href="mailto:hello@docontract.com">contact</a> me (ha-ha) and I will try to help you see what is wrong as soon as possible.</p>');
	
	BuildContractFromJSON (JSON.parse(plainText));
}

function LoadFromServer(fileName)
{
	loadedObject = fileName;
	
	agreementIsCustom = false;
	
	//set content text to 'loading'
	content.html('<p style="margin-top: 30px;"><i class="fa fa-cog fa-spin fa-lg"></i> Loading the agreement template from the server...</p>');
	
	$.getJSON(fileName, function(JSONdata) { BuildContractFromJSON(JSONdata); } );
}

function BuildContractFromJSON (JSONdata) 
{
	data = JSONdata;
	
	GetDataFromCookie();
	
	var s = [];
	var c = [];
	
	$.each(data, function(sectionID, section)
	{
		if(sectionID == "contractInfo") 
			return true;
		
		if(!section.hasOwnProperty('selectedTemplate'))
			section.selectedTemplate = 0;
		
		s.push('<div id="');
		s.push(sectionID);
		s.push('Sidebar">');
		
		//header in sidebar
		if(section.hasOwnProperty('header'))
		{
			s.push('<h2>');
			s.push(GetHeaderWithNumbering(sectionID));
			s.push('</h2>');
			
			if(Object.keys(section.template[0].variables).length == 0)
			{
				s.push('<label>This section has no variable data.</label>');
			}
		}
	
		//section selector
		if(section.hasOwnProperty('select'))
			s.push('<p class="selector"></p>');
		
		s.push('<div class="variables"></div></div>');
		
		//header in text
		if(section.hasOwnProperty('header'))
		{
			if(c.length != 0)
				c.push('</section>');
			
			c.push('<section');
			
			if(section.hasOwnProperty('avoidPageBreak'))
				c.push(' class="avoidPageBreak"');
			
			c.push('><h1>');
			c.push(GetHeaderWithNumbering(sectionID));
			c.push('</h1>');
		}
		
		c.push('<div id="');
		c.push(sectionID);
		c.push('Content">');
		
		//section template
		c.push('<div class="template"></div>');
		
		c.push('</div>');
		
	});
	
	//close the last section!
	c.push('</section>');
	
	sidebar.html(s.join(""));
	content.html(c.join(""));

	$.each(data, function(sectionID, section)
	{
		if(sectionID == "contractInfo")
			return true;
		
		CheckRefreshDependencies(sectionID);
		
		if(section.hasOwnProperty('select'))
		{
			section.selector = $('#' + sectionID + 'Sidebar .selector', sidebar);
			RefreshOptionSelector(sectionID);
		}
		
		section.variables = $('#' + sectionID + 'Sidebar .variables', sidebar);
		section.content = $('#' + sectionID + 'Content .template:first', content);
		
		RefreshSidebar(sectionID);
		RefreshContent(sectionID);
	});

	SetVersionInfo();
	SetTitle();
}

function CheckRefreshDependencies(sectionID)
{
	//check for lists with dependencies
	$.each(data[sectionID].template, function(templateID, template)
	{
		$.each(template.variables, function(variableID, variable)
		{
			if(variable.hasOwnProperty('takeListLengthSectionID'))
			{
				//then tell THAT variable to update ME when it changes!
				data[variable.takeListLengthSectionID].template[variable.takeListLengthTemplateID].variables[variable.takeListLengthVariableID].refreshSectionID = sectionID;
			}
		});
	});
}

function RefreshDependencies(sectionID)
{
	for(var dependingSectionID in data[sectionID].template[data[sectionID].selectedTemplate].dependencies)
	{
		data[sectionID].content.html(GetReplacedText(sectionID));
	}
}

function RefreshOptionSelector(sectionID)
{
	var s = [];
	
	s.push('<label>');
	s.push(ReplaceDefaultTags(data[sectionID].select.label, false));
	s.push(' </label>');
	
	if(data[sectionID].select.description)
	{
		s.push(' <span class="noborder"><a href="javascript:void(0)" data-tooltip="');
		s.push(ReplaceDefaultTags(data[sectionID].select.description, false));
		s.push('" tabIndex="-1"><i class="fa fa-question-circle" style="vertical-align: middle;"></i></a></span>');
	}
	
	s.push('<br><select>');

	//either get the selected option for each template from the cookie, or set it to 0 (even if it is corrupted)
	var selectedOption = GetCookie(sectionID + 'Selected');
	if(selectedOption == null || selectedOption.length > 2) selectedOption = 0;
	data[sectionID].selectedTemplate = parseInt(selectedOption);

	$.each(data[sectionID].select.options, function(optionID, option)
	{
		s.push('<option value="');
		s.push(sectionID);
		s.push(optionID);
		s.push('" ');

		//make sure to select the option that the user already chose earlier!
		if(data[sectionID].selectedTemplate == optionID)
			s.push('selected');

		s.push('>');
		s.push(ReplaceDefaultTags(option, false));
		s.push('</option>');
	});

    s.push('</select>');
	
	data[sectionID].selector.html(s.join(''));
	
	//add change event to option selector
	
	var optionSelector = $('#' + sectionID + 'Sidebar select', sidebar);
	
	optionSelector.unbind('change');
	
	optionSelector.change(function (e)
	{
		var previousSelectedTemplate = data[sectionID].selectedTemplate;
		
		data[sectionID].selectedTemplate = this.value.slice(-1);
		SetCookie(sectionID + 'Selected', this.value.slice(-1), 1);

		RefreshSidebar(sectionID);
		RefreshContent(sectionID);

		$('input[type="text"]:first', data[sectionID].variables).select();
		
		//see if a variable in previous template wanted a refresh
		CheckVariablesForRefresh(sectionID, previousSelectedTemplate);
		
		//see if a variable in the current template wants a refresh
		CheckVariablesForRefresh(sectionID, data[sectionID].selectedTemplate);
		
		
	});
}

function CheckVariablesForRefresh(sectionID, templateID)
{
	$.each(data[sectionID].template[templateID].variables, function(variableID, variable) {
		if(variable.hasOwnProperty('refreshSectionID'))
		{
			RefreshSidebar(variable.refreshSectionID);
			RefreshContent(variable.refreshSectionID);
		}
	});
}

function RefreshSidebar(sectionID)
{
	var template = data[sectionID].template[data[sectionID].selectedTemplate];
	
	//remove variable html
	data[sectionID].variables.empty();
	
	$.each(template.variables, function(variableID, variable)
	{
		if(variable.hasOwnProperty('type') && variable.type != 'text')
		{
			if(variable.type == 'list')
				AppendListInput(sectionID, variableID, variable);
			else if(variable.type == 'checkbox')
			{
				//if this variable needs a checkbox somewhere that is or isn't checked, don't add it
				if((variable.hasOwnProperty('onlyDisplayIfChecked') && !template.variables[variable.onlyDisplayIfChecked]['isChecked']) || (variable.hasOwnProperty('onlyDisplayIfUnchecked') && template.variables[variable.onlyDisplayIfUnchecked]['isChecked']))
					return true;
				
				AppendCheckboxInput(sectionID, variableID, variable);
			}
				
		}
		else
		{
			//if this variable needs a checkbox somewhere that is or isn't checked, don't add it
			if((variable.hasOwnProperty('onlyDisplayIfChecked') && !template.variables[variable.onlyDisplayIfChecked]['isChecked']) || (variable.hasOwnProperty('onlyDisplayIfUnchecked') && template.variables[variable.onlyDisplayIfUnchecked]['isChecked']))
				return true;
			
			AppendTextInput(sectionID, variableID, variable);
		}
	});
	
	$.each(template.variables, function(variableID, variable)
	{
		var extraCheckboxCheck = "";
		
		if(variable.hasOwnProperty('onlyDisplayIfChecked'))
			extraCheckboxCheck = variable.onlyDisplayIfChecked;
		else if(variable.hasOwnProperty('onlyDisplayIfUnchecked'))
			extraCheckboxCheck = variable.onlyDisplayIfUnchecked;
		
		if(extraCheckboxCheck != "")
		{
			$(InputSelector(extraCheckboxCheck), data[sectionID].variables).change(function () 
			{
				RefreshSidebar(sectionID);
				RefreshContent(sectionID);
				
				FocusOnNextInput($(InputSelector(extraCheckboxCheck), data[sectionID].variables));
			});
		}
		
		if(variable.hasOwnProperty('type') && variable.type != 'text')
		{
			
			if(variable.type == 'list')
			{
				var inputFieldAmount = GetInputFieldAmount(variable, variable.list.length + 1);
				
				for(var i = 0; i < inputFieldAmount; i++)
				{
					
					$(InputSelector(variableID + i), data[sectionID].variables).change(function () 
					{
						var thisIndex = parseInt($(this).attr('name').slice(-1));
						
						if(variable.hasOwnProperty('takeListLengthSectionID'))
						{
							variable.list[thisIndex] = $(this).val().trim();
							RefreshContent(sectionID);
							SetCookie(variableID + thisIndex, variable.list[thisIndex], 1);
							
							if(variable.list[thisIndex] != "")
								FocusOnNextInput($(InputSelector(variableID + thisIndex), data[sectionID].variables));
						}
						else if(thisIndex != variable.list.length && $(this).val() == "")
						{
							//if empty and not the last one, remove me
							
							variable.list.splice(thisIndex,1);
							RefreshSidebar(sectionID);
							RefreshContent(sectionID);
							
							//reset cookies
							for(var j = 0; j < 10; j++)
							{
								if(j >= variable.list.length)
								{
									DeleteCookie(variableID + j);
								}
								else
								{
									SetCookie(variableID + j, variable.list[j], 1);
								}
							}
							
							$(InputSelector(variableID + thisIndex), data[sectionID].variables).select();
							
						}
						else
						{
							if(thisIndex == variable.list.length && $(this).val() != "")
							{
								//if last one and not empty, add another field
								variable.list.push($(this).val().trim());
								RefreshSidebar(sectionID);
							}
							
							variable.list[thisIndex] = $(this).val().trim();
							RefreshContent(sectionID);
							SetCookie(variableID + thisIndex, variable.list[thisIndex], 1);
							
							if(variable.list[thisIndex] != "")
								FocusOnNextInput($(InputSelector(variableID + thisIndex), data[sectionID].variables));
						}
						
						if(variable.hasOwnProperty('refreshSectionID'))
						{
							RefreshSidebar(variable.refreshSectionID);
							RefreshContent(variable.refreshSectionID);
						}
						
					});
				}
				
			}
			else if(variable.type == 'checkbox')
			{
				$(InputSelector(variableID), data[sectionID].variables).change(function () 
				{
					variable.isChecked = $(this).is(":checked");
					RefreshContent(sectionID);
					SetCookie(variableID, variable.isChecked ? "true" : "false", 1);
					
					FocusOnNextInput($(InputSelector(variableID), data[sectionID].variables));
				});
			}
			
		}
		else
		{
			$(InputSelector(variableID), data[sectionID].variables).change(function () 
			{
				variable.value = $(this).val().trim();
				
				if(sectionID == 'agreement')
				{
					if(variableID == 'company' || variableID == 'companyLegal' || variableID == 'companyAddress')
					{
						//set cookie for a long time, because we'll want to remember this eternally!
						SetCookie(variableID, variable.value, 356);
					}
					else
					{
						SetCookie(variableID, variable.value, 1);
					}
					
					if(variableID == 'company' || 
					   variableID == 'contractor' || 
					   variableID == 'projectName')
					{
						//set the title of the page if possible
						SetTitle();
					}
					
					$.each(data, function(loopSectionID)
					{
						if(loopSectionID == "contractInfo") return true;
						
						if(variableID == 'company' || variableID == 'contractor')
						{
							//also refresh the sidebar if the variable we changed is company or contractor, 
							// because labels and descriptions also have tags
							
							RefreshSidebar(loopSectionID);
							
							if(data[loopSectionID].hasOwnProperty('select'))
							{
								RefreshOptionSelector(loopSectionID);
							}
						}
						
						RefreshContent(loopSectionID);
					});
				}
				else
				{
					SetCookie(variableID, variable.value, 1);
					RefreshContent(sectionID);
				}
				
				if(variable.value != "")
					FocusOnNextInput($(InputSelector(variableID), data[sectionID].variables));
				
			});
		}
	});
}

function GetInputFieldAmount(variable, defaultAmount)
{
	var inputFieldAmount = defaultAmount;
	
	if(variable.hasOwnProperty('takeListLengthSectionID'))
	{
		if(data[variable.takeListLengthSectionID].selectedTemplate == variable.takeListLengthTemplateID)
		{
			inputFieldAmount = data[variable.takeListLengthSectionID].template[variable.takeListLengthTemplateID].variables[variable.takeListLengthVariableID].list.length;
		}
		else
		{
			inputFieldAmount = 0;
		}
	}
	
	return inputFieldAmount;
}

function FocusOnNextInput(currentInput)
{
	//move the focus to the next (refreshed!!) input
	$(':input:eq(' + ($(':input').index(currentInput) + 1) + ')').select();
}

function AppendTextInput(sectionID, variableID, variable)
{
	var p = [];
	
	p.push('<p><label>');
	p.push(ReplaceDefaultTags(variable.label, false));
	p.push(':</label>');
	
	p.push(GetTooltipHTML(variableID, variable));
	
	p.push('<br><input type="text" name="');
	p.push(variableID);
	p.push('" value="');
	p.push(variable.value);
	p.push('" placeholder="');
	p.push(variable.placeholder);
	p.push('">');
	
	p.push(GetExampleHTML(variableID, variable));
	
	p.push('</p>');
	
	data[sectionID].variables.append(p.join(""));
	
	var input = $(InputSelector(variableID), data[sectionID].variables);
	var exampleLabel = $('#' + variableID + 'Examples', data[sectionID].variables);
	
	input.focus(function() 
	{
	    exampleLabel.css( "display", "block");
		input.blur(function() 
		{
			exampleLabel.css( "display", "none");
		});
	});
}



function AppendListInput(sectionID, variableID, variable)
{
	var p = [];
	
	p.push('<p><label>');
	p.push(ReplaceDefaultTags(variable.label, false));
	p.push(':</label>');
	
	p.push(GetTooltipHTML(variableID, variable));
	
	var inputFieldAmount = GetInputFieldAmount(variable, variable.list.length + 1);
	
	if(inputFieldAmount == 0)
	{
		p.push('<br><label class="unfilledNotice">');
		p.push(variable.takeListLengthWarning);
		p.push('</label>');
	}
	
	for(var i = 0; i < inputFieldAmount && i < 10; i++)
	{
		p.push('<br><input type="text" name="');
		p.push(variableID);
		p.push(i);
		p.push('" value="');
		
		if(i != variable.list.length)
			p.push(variable.list[i]);

		p.push('"');
		
		if(i == variable.list.length && i != 0 && !variable.hasOwnProperty('takeListLengthSectionID'))
			p.push(' class="allowEmpty" ');	
		
		p.push('placeholder="');
		
		if(i != variable.list.length)
		{
			p.push(variable.placeholderItem);
		}	
		else
		{
			p.push(variable.placeholderAdd);
		}
		
		p.push('">');
	}
	
	p.push(GetExampleHTML(variableID, variable));
	
	p.push('</p>');
	
	data[sectionID].variables.append(p.join(""));
	
	var exampleLabel = $('#' + variableID + 'Examples', data[sectionID].variables);
	
	for(var j = 0; j < inputFieldAmount && j < 10; j++)
	{
		var input = $(InputSelector(variableID + j), data[sectionID].variables);
		
		input.focus(function() 
		{
			exampleLabel.css( "display", "block");
			
			input.blur(function() 
			{
				exampleLabel.css( "display", "none");
			});
		});
		
		
	}
	
}

function AppendCheckboxInput(sectionID, variableID, variable)
{
	var p = [];
	
	p.push('<p><input type="checkbox" id="');
	p.push(variableID);
	p.push('" name="');
	p.push(variableID);
	p.push('"');
	
	if(variable.isChecked)
		p.push('checked');
	
	p.push('><label for="');
	p.push(variableID);
	p.push('">');
	p.push(ReplaceDefaultTags(variable.label, false));
	p.push('</label>');
	
	p.push(GetTooltipHTML(variableID, variable));
	
	p.push('</p>');
	
	data[sectionID].variables.append(p.join(""));
}

function GetTooltipHTML(variableID, variable)
{
	var t = [];
	
	if(variable.description)
	{
		t.push(' <span class="noborder"><a href="#" data-tooltip="');
		t.push(ReplaceDefaultTags(variable.description, false));
		t.push('" tabIndex="-1"><i class="fa fa-question-circle" style="vertical-align: middle;"></i></a></span>');
	}
	
	return t.join("");
}

function GetExampleHTML(variableID, variable)
{
	var e = [];
	
	if(variable.examples && variable.examples.length > 0)
	{
		e.push('<br><label id="');
		e.push(variableID);
		e.push('Examples" style="display: none;" class="exampleLabel">For example: \'');
		e.push(variable.examples[0]);
		e.push('\'');
	
		for(var i = 1; i < variable.examples.length; i++)
		{
			e.push(' or \'');
			e.push(variable.examples[i]);
			e.push('\'');
		}
		
		e.push('.</label>');
	}
	
	return e.join("")
}

function RefreshContent(sectionID)
{
	
	data[sectionID].content.html(GetReplacedText(sectionID));
	
	if(data[sectionID].hasOwnProperty('refreshAdditionalContent'))
	{
		$.each(data[sectionID].refreshAdditionalContent, function(refreshSectionID, refreshSection)
		{
			data[refreshSection].content.html(GetReplacedText(refreshSection));
			
		});
	}
	
	data[sectionID].content.html(GetReplacedText(sectionID));
}

function GetReplacedText(sectionID)
{
	var template = data[sectionID].template[data[sectionID].selectedTemplate];
	var output = template.text;
	
	$.each(template.variables, function(variableID, variable)
	{
		if(variable.hasOwnProperty('type') && variable.type != 'text')
		{
			if(variable.type == 'list')
			{
				output = ReplaceListInText(output, sectionID, variableID, variable);
			}
			else if(variable.type == 'checkbox')
			{
				output = ReplaceTagsInText(
					output, 
					variableID, 
					variable.isChecked ? variable.checked : variable.unchecked);
			}
		}
		else
		{
			if((variable.hasOwnProperty('onlyDisplayIfChecked') && !template.variables[variable.onlyDisplayIfChecked]['isChecked']) || (variable.hasOwnProperty('onlyDisplayIfUnchecked') && template.variables[variable.onlyDisplayIfUnchecked]['isChecked']))
			{
				output = ReplaceTagsInText(output, variableID, null, makeDataBold);
			}
			else if(variable.hasOwnProperty('value'))
			{
				output = ReplaceTagsInText(output, variableID, variable.value, makeDataBold);
			}
				
		}
	});
	
	output = ReplaceDefaultTags(output, makeDataBold);
	
	if(output.indexOf('[#.#]') != -1)
	{
		output = ReplaceNumberingInText(sectionID, output);
	}
	
	return output;
}

function ReplaceDefaultTags(text, makeStrong)
{
	
	$.each(data.agreement.template[0].variables, function(variableID, variable)
	{
		if(variable.hasOwnProperty('value'))
		{
			text = ReplaceTagsInText(text, variableID, variable.value, makeStrong);
		}
	});
	
	return text;
}

function ReplaceTagsInText(text, replacing, replacement, makeStrong)
{
	if(replacement == null)
	{
		replacement = "";
	}
	else if(replacement == " " || replacement == "")
	{
		replacement = ['[', replacing, ']'].join('');
	}
	else
	{
		if(makeStrong)
		{
			replacement = ['<strong>', replacement, '</strong>'].join('');
		}
	}
	
	text = text.replace(new RegExp(EscapeRegExp(['[', replacing, ']'].join("")), 'gi'), replacement);
	
	return text;
}

function ReplaceListInText(text, sectionID, variableID, variable)
{
	var r = [];
	
	var inputFieldAmount = GetInputFieldAmount(variable, variable.list.length);
	
	r.push('<ul>');
	if(inputFieldAmount > 0)
	{
		for(var i = 0; i < inputFieldAmount && i < 10; i++)
		{
			r.push('<li>');
			if(variable.hasOwnProperty('prefix'))
			{
				r.push(variable.prefix);
				r.push(i + 1);
				r.push(variable.separator);
			} 
			if(makeDataBold) r.push('<strong>');
			var currentValue = $(InputSelector(variableID + i), data[sectionID].variables).val();
			if(currentValue == "")
				r.push('undefined');
			else
				r.push(currentValue);
			
			if(makeDataBold) r.push('</strong>');
			r.push('.</li>');
		}
		
	}
	else
	{
		r.push('<li>...</li><li>...</li><li>...</li>');
	}
	r.push('</ul>');
	
	
	text = text.replace(new RegExp(EscapeRegExp(['[', variableID, ']'].join("")), 'gi'), r.join(""));
	return text;
}

function GetHeaderWithNumbering(sectionID)
{
	if(!data['contractInfo'].hasOwnProperty('headerNumberingCounter'))
		data['contractInfo'].headerNumberingCounter = 1;
	
	var textParts = data[sectionID].header.split('[#]');
	
	if(textParts.length > 1)
	{
		if(!data[sectionID].hasOwnProperty('numbering'))
		{
			data[sectionID].numbering = data['contractInfo'].headerNumberingCounter;
			data['contractInfo'].headerNumberingCounter++;
		}
		
		for(var i = 0; i < textParts.length - 1; i++)
		{
			textParts[i] += data[sectionID].numbering + '.';
		}
	}
	
	return textParts.join("");
}

function ReplaceNumberingInText(sectionID, text)
{
	var numberingSectionID = sectionID;
	
	if(!data[numberingSectionID].hasOwnProperty('numbering'))
	{
		//check previous sections for a leading number
		var dataKeys = Object.keys(data);
		var sectionKey = -1;
		var additionalContentToBeRefreshed = [];
		
		for(var i = dataKeys.length; i > 0; i--)
		{
			if(dataKeys[i] == numberingSectionID)
			{
				sectionKey = i;
				continue;
			}
			
			if(sectionKey != -1)
			{
				additionalContentToBeRefreshed.push(dataKeys[i]);
				
				if(data[dataKeys[i]].hasOwnProperty('numbering'))
				{
					numberingSectionID = dataKeys[i];
					
					for(var otherSectionKey = additionalContentToBeRefreshed.length - 1; 
						otherSectionKey >= 0;
						otherSectionKey--)
					{
						var otherSecID = additionalContentToBeRefreshed[otherSectionKey];
						
						if(!data[otherSecID].hasOwnProperty('refreshAdditionalContent'))
						{
							data[otherSecID].refreshAdditionalContent = [];
						}
						
						if($.inArray(sectionID, data[otherSecID].refreshAdditionalContent) == -1)
						{
							data[otherSecID].refreshAdditionalContent.push(sectionID);
						}
						
						if(!data[sectionID].hasOwnProperty('refreshAdditionalContent'))
						{
							data[sectionID].refreshAdditionalContent = [];
						}
						
						if($.inArray(otherSecID, data[sectionID].refreshAdditionalContent) == -1)
						{
							data[sectionID].refreshAdditionalContent.push(otherSecID);
						}
							
					}
					
					break;
				}
			}
		}
		
		//if we still don't have a section ID for numbering because 
		// there are no previous sections with numbering, fuck it.
		if(!data[numberingSectionID].hasOwnProperty('numbering'))
			return text;
	}
	
	if(!data[numberingSectionID].hasOwnProperty('subNumbering') || sectionID == numberingSectionID)
		data[numberingSectionID].subNumbering = 1;
	
	var textParts = text.split('[#.#]');
	
	if(textParts.length > 1)
	{
		for(var i = 0; i < textParts.length - 1; i++)
		{
			textParts[i] += data[numberingSectionID].numbering + '.' + data[numberingSectionID].subNumbering + '.';
			data[numberingSectionID].subNumbering++;
		}
	}
	
	return textParts.join("");
}

function InputSelector(variableName)
{
	return ['input[name="', variableName, '"]'].join("");
}

function EscapeRegExp(string) 
{
    return string.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, "\\$1");
}

function SetVersionInfo()
{
	var versionInfo = [];
	
	if(data['contractInfo'].hasOwnProperty('version'))
	{
		if(data['contractInfo'].hasOwnProperty('basedOnEnglishVersion') && data['contractInfo'].basedOnEnglishVersion != data['contractInfo'].version)
		{
			versionInfo.push('Template v');
			versionInfo.push(Number(data['contractInfo'].version).toFixed(2).toString());
			versionInfo.push(', based on English v');
			versionInfo.push(Number(data['contractInfo'].basedOnEnglishVersion).toFixed(2).toString());
			
			if(data['contractInfo'].hasOwnProperty('lastModification'))
			{
				versionInfo.push('.</p><p class="faded"><i class="fa fa-clock-o fa-lg fa-fw"></i> Last modifications: ');
				versionInfo.push(data['contractInfo'].lastModification);
			}
			
			
		}
		else
		{
			versionInfo.push('Template v');
			versionInfo.push(Number(data['contractInfo'].version).toFixed(2));
			
			if(data['contractInfo'].hasOwnProperty('lastModification'))
			{
				versionInfo.push(', last modifications: ');
				versionInfo.push(data['contractInfo'].lastModification);
			}
		}
		
		versionInfo.push('.');
	}
	else
	{
		versionInfo.push('Template has no version variable.');
	}
	
	$('#versionInfo').html(versionInfo.join(''));
}

function SetTitle()
{
	if(!agreementIsCustom)
	{
		if(data['agreement'].template[0].variables.company.hasOwnProperty('value') &&
			data['agreement'].template[0].variables.company.value != "" &&
			data['agreement'].template[0].variables.contractor.hasOwnProperty('value') &&
			data['agreement'].template[0].variables.contractor.value != "" &&
			data['agreement'].template[0].variables.projectName.hasOwnProperty('value') &&
			data['agreement'].template[0].variables.projectName.value != "")
		{
			document.title = 
				"Agreement-" + 
				data['agreement'].template[0].variables.projectName.value + 
				"-" + 
				data['agreement'].template[0].variables.company.value + 
				"-" + 
				data['agreement'].template[0].variables.contractor.value;
		}
		else
		{
			document.title = "contract( )";
		}
	}
	else
	{
		document.title = "contract( )";
	}
	
}

function ScrollTo(elementID)
{
	// ga('send', 'event', 'Interface', 'scrolled to ' + elementID);
	
	$('html, body').animate({
	    scrollTop: $('#' + elementID).offset().top
	}, 500);
}

function ShowDefaultAgreement()
{
	$('#defaultInterfaceShow').hide();
	$('#customInterfaceShow').show();
	$('#customInterface').hide("slow");
	
	if(loadedObject != './contracts/workforhire-en.json')
		LoadDefaultAgreement();
}

function ShowCustomAgreement()
{
	$('#defaultInterfaceShow').show();
	$('#customInterfaceShow').hide();
	$('#customInterface').show("slow");
	
	if(document.getElementById('fileInput').files.length > 0)
		RefreshTemplateFile();
		
}

function EnableTemplateFileInput()
{
	var fileInput = document.getElementById('fileInput');
	
	fileInput.addEventListener('change', function(e) 
	{
		$('#fileSelector').hide();
		
		var file = fileInput.files[0];
		
		var isJSON = false;
		if(file.type.match('application/json')) isJSON = true; //default
		else if(file.name.lastIndexOf(".json") == file.name.length - 5) isJSON = true; //on windows 10, but not in
		if (isJSON) 
		{
			var reader = new FileReader();

			reader.onload = function(e) 
			{
				if(!sentAnonymousCustomTemplateUsage)
				// {
				// 	ga('send', 'event', 'Custom agreement', 'loaded');
				// 	sentAnonymousCustomTemplateUsage = true;
				// }
				
				LoadFromLocal(reader.result);
				
				$('#fileSelectorLabel').html("<i class=\"fa fa-file-code-o fa-fw\"></i> <strong>" + file.name + "</strong>: <i class=\"fa fa-refresh\"></i> <a href=\"javascript:RefreshTemplateFile()\">Refresh</a> or <i class=\"fa fa-times fa-lg\"></i> <a href=\"javascript:ResetTemplateFileInput()\">Replace</a>");
				
				// window.setTimeout(function() { ResetTemplateFileInput(); }, 3000);
			}
			
			reader.readAsText(file);	
		} 
		else 
		{
			$('#fileSelectorLabel').html("Only .json files can be loaded.");
			window.setTimeout(function() { ResetTemplateFileInput(); }, 3000);
		}
		
	});
}

function RefreshTemplateFile()
{
	var reader = new FileReader();
	
	reader.onload = function(e) 
	{
		LoadFromLocal(reader.result);
	}
	
	reader.readAsText(document.getElementById('fileInput').files[0]);
}

function ResetTemplateFileInput()
{
	// cut jquery
	// $('#fileSelectorLabel').html("<span style=\"font-size: 0.9em;\">Your template: </span>");
	document.getElementById('fileSelectorLabel').innerHTML = "<span style=\"font-size: 0.9em;\">Your template: </span>";
	
	document.getElementById('fileInput').value = "";
	// cut jquery
	// $('#fileSelector').show();
	document.getElementById('fileSelector').show();
	
	EnableTemplateFileInput();
}

function RequestDataReset()
{
	var question = [];
	
	question.push('<i class="fa fa-exclamation fa-lg fa-fw"></i> Are you sure you want to erase all data and reset the agreement? <i class="fa fa-trash-o fa-lg"></i> <a href="javascript:');
	
	question.push('ResetData');
	
	question.push('()">Yes</a> <i class="fa fa-close fa-lg"></i> <a href="javascript:CancelDataReset()">No</a>');
	
	$('#resetButton').html(question.join(''));
}

function CancelDataReset()
{
	$('#resetButton').html('<i class="fa fa-trash-o fa-lg fa-fw"></i> <a href="javascript:RequestDataReset()">Clear data and reset agreement</a>.');
}

function ResetData()
{
	DeleteAllCookies();
	
	if(agreementIsCustom)
		LoadFromLocal(loadedObject);
	else
		LoadFromServer(loadedObject);
	
	CancelDataReset()
}

function ToggleBoldText(setBold)
{
	if(typeof data === 'undefined')
		return true;
	
	if(typeof setBold !== 'undefined')
		makeDataBold = setBold;
	else
		makeDataBold = !makeDataBold;
	
	$.each(data, function(sectionID, section)
	{
		if(sectionID == "contractInfo") 
			return true;
		
		RefreshContent(sectionID);
		
	});
	
	if(makeDataBold)
	{
		$('#content').parent().removeClass('agreementStyleReset');
		$('#toggleBold').html('Toggle text <strong>markup</strong>');
	}
	else
	{
		$('#content').parent().addClass('agreementStyleReset');
		$('#toggleBold').html('Toggle text markup');
	}
}

function TryPrint()
{
	var sidebar = $('#sidebar');
	var emptyInputs = [];
	
	$('input[type="text"]:not([class="allowEmpty"])', sidebar).each(function() {
		if($(this).val() == "")
		{
			emptyInputs.push($(this));
		}
	});
	
	if(emptyInputs.length == 0)
	{
		if(!sentAnonymousAgreementUsage)
		{
			if(!agreementIsCustom)
			{
			
				var compensationId = data.compensation.selectedTemplate;
				var compensationString = "";
	
				switch(compensationId)
				{
					default:
					case 0: compensationString = "fixed fee"; break;
					case 1: compensationString = "fixed rate"; break;
					case 2: compensationString = "fee per milestone"; break;
					case 3: compensationString = "percentage of gross receipts"; break;
				}
	
				var rightsId = data.ip.selectedTemplate;
				var rightsString = "";
	
				switch(rightsId)
				{
					default:
					case 0: rightsString = "company can use contractors work"; break;
					case 1: rightsString = "company will own contractors work"; break;
				}
				
				var version = "";
				
				if(data['contractInfo'].language != "en" && data['contractInfo'].hasOwnProperty('basedOnEnglishVersion'))
				{
					version =  Number(data['contractInfo'].basedOnEnglishVersion).toFixed(2).toString();
				}
				else
				{
					version = Number(data['contractInfo'].version).toFixed(2).toString();
				}
				
				// ga('send', 'event', 'Compensation terms', compensationString);
				// ga('send', 'event', 'Rights terms', rightsString);
				// ga('send', 'event', 'Default agreement v' + version, 'saved');
				// ga('send', 'event', 'Language', data['contractInfo'].language);
			}
			else
			{
				// ga('send', 'event', 'Custom agreement', 'saved');
			}
			
			sentAnonymousAgreementUsage = true;
		}
		
		ToggleBoldText(false);
		window.print();
	}
	else
	{
		$.each(emptyInputs, function() {
			
			$(this).parent().children("label:first-of-type").addClass('unfilledNotice');
			
			$(this).focus(function()
			{
				$(this).parent().children("label:first-of-type").removeClass('unfilledNotice');
			});
			
		});
		
		$('#printButton').html('<i class="fa fa-print fa-lg fa-fw"></i> You haven\'t filled in everything.');
		
		window.setTimeout(function() { ResetPrintNotice(); }, 3000);
	}
}

function ResetPrintNotice()
{
	$('#printButton').html('<i class="fa fa-print fa-lg fa-fw"></i> <a href="javascript:TryPrint()">Print agreement or save it as PDF</a>.');
}

function GetDataFromCookie()
{
	$.each(data, function(sectionID, section)
	{
		if(sectionID == "contractInfo") return true;
		
		$.each(section.template, function(templateID, template)
		{
			$.each(template.variables, function(variableID, variable)
			{
				if(variable.hasOwnProperty('type') && variable.type != 'text')
				{
					if(variable.type == 'list')
					{
						for(var i = 0; i < 10; i++)
						{
							var cookieVar = GetCookie(variableID + i);
							
							if(cookieVar != null)
							{
								variable.list[i] = cookieVar;
							}
							else
							{
								break;
							}
						}
					}
					else if(variable.type == 'checkbox')
					{
						var cookieVar = GetCookie(variableID);
						
						if(cookieVar != null)
						{
							variable.isChecked = cookieVar == "true" ? true : false;
						}
					}
				
				}
				else
				{
					var cookieVar = GetCookie(variableID);
				
					if(cookieVar != null)
					{
						variable.value = cookieVar;
					}
				}
			});
		});
	});
}

function SetCookie(name,value,days) 
{
	if (days) 
	{
		var date = new Date();
		date.setTime(date.getTime()+(days*24*60*60*1000));
		var expires = "; expires="+date.toGMTString();
	}
	else var expires = "";
	document.cookie = name+"="+encodeURI(value)+expires+"; path=/";
}

function GetCookie(name) 
{
	var nameEQ = name + "=";
	var ca = document.cookie.split(';');
	for(var i=0;i < ca.length;i++) {
		var c = ca[i];
		while (c.charAt(0)==' ') c = c.substring(1,c.length);
		if (c.indexOf(nameEQ) == 0) return decodeURI(c.substring(nameEQ.length,c.length));
	}
	return null;
}

function DeleteCookie(name) 
{
	SetCookie(name,"",-1);
}

function DeleteAllCookies() 
{
    var cookies = document.cookie.split(";");

    for (var i = 0; i < cookies.length; i++) 
	{
    	var cookie = cookies[i];
    	var eqPos = cookie.indexOf("=");
    	var name = eqPos > -1 ? cookie.substr(0, eqPos) : cookie;
    	SetCookie(name,"",-1);
    }
}