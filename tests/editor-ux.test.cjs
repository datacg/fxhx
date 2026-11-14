const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { fixture, plain } = require('./helpers.cjs');
const { ui } = require('./ui-harness.cjs');
function example(h, options = {}) {
    const comp = h.comp(), layer = comp.addLayer();
    const props = [h.prop('Exposure', 5), h.prop('Radius', 80),
        h.prop('Blend Mode', 1, 'OneD', { propertyParameters: ['Screen', 'Add'], ...options })];
    layer.parade.effects.push(h.effect(layer, 'ADBE Glo2', 0, props));
    return { comp, layer, props, effect: layer.parade.property(1) };
}
function ready(options) {
    const h = ui(options), e = example(h), p = h.start();
    h.scan(p); h.click(p, 'Select Results'); h.read(p); h.drain(p);
    return { h, p, ...e };
}
function flagged(h,d,type,flag) { return h.all(d,type).find(c => c[flag]); }
function choose(h,d,name) {
    const list = flagged(h,d,'listbox','fxParameterList');
    list.selection = list.items.find(item => item.fxEditorRow.name === name); list.onChange();
}
function numeric(h,d,name,value) {
    choose(h,d,name); const field=h.parameterFields(d)[0];
    field.text=String(value); field.onChanging();
}
test('search preserves multiple staged changes and applying sends one batch including a named menu', () => {
    const {h,p,props}=ready();
    h.dialogHooks['Edit Parameters']=d=>{
        numeric(h,d,'Exposure',20);
        const search=flagged(h,d,'edittext','fxParameterSearch');
        search.text='RADIUS'; search.onChanging();
        const list=flagged(h,d,'listbox','fxParameterList');
        assert.deepEqual(list.items.map(i=>i.text),['Radius']);
        const input=h.parameterFields(d)[0]; input.text='90'; input.onChanging();
        search.text='blend screen'; search.onChanging();
        assert.deepEqual(list.items.map(i=>i.text),['Blend Mode']);
        const menu=flagged(h,d,'dropdownlist','fxParameterMenu');
        assert.deepEqual(menu.items.map(i=>i.text),['Keep original values','Screen','Add']);
        menu.selection=2; menu.onChange();
        assert.equal(flagged(h,d,'listbox','fxPendingChanges').items.length,3);
        assert.equal(h.calls.filter(c=>c[0]==='set').length,0);
        h.click(d,'Apply');
    };
    h.click(p,'Edit Parameters...'); h.drain(p);
    assert.deepEqual(props.map(p=>p.value),[20,90,2]);
    assert.equal(h.calls.filter(c=>c[0]==='begin').length,1);
    assert.equal(h.calls.filter(c=>c[0]==='set').length,3);
    assert.ok(h.confirmations.some(c=>/Add/.test(c)));
});
test('pending list navigation keeps the correct drafts under programmatic dropdown notifications',()=>{
    const {h,p}=ready({selectionNotifications:'always'});
    h.dialogHooks['Edit Parameters']=d=>{
        numeric(h,d,'Exposure',20); numeric(h,d,'Radius',90);
        const search=flagged(h,d,'edittext','fxParameterSearch'); search.text='blend';search.onChanging();
        const pending=flagged(h,d,'listbox','fxPendingChanges');
        pending.selection=pending.items.find(i=>i.text==='Exposure');pending.onChange();
        const list=flagged(h,d,'listbox','fxParameterList');
        assert.equal(list.selection.text,'* Exposure');
        assert.equal(h.parameterFields(d)[0].text,'20');
        choose(h,d,'Radius');assert.equal(h.parameterFields(d)[0].text,'90');
        h.click(d,'Clear this change');
        assert.deepEqual(pending.items.map(i=>i.text),['Exposure']);
        h.click(d,'Clear all changes');assert.equal(pending.items.length,0);
        assert.equal(h.all(d,'button').find(b=>b.fxTitle==='Apply').enabled,false);
        h.click(d,'Cancel');
    };
    h.click(p,'Edit Parameters...');
    assert.equal(h.notifications.overflow,0);assert.equal(h.alerts.length,0);
    assert.equal(h.calls.filter(c=>c[0]==='set').length,0);
});
test('search with no matches keeps pending changes applicable and shows an empty state',()=>{
    const {h,p,props}=ready();
    h.dialogHooks['Edit Parameters']=d=>{
        numeric(h,d,'Exposure',21);
        const search=flagged(h,d,'edittext','fxParameterSearch');search.text='nonexistent';search.onChanging();
        assert.equal(flagged(h,d,'listbox','fxParameterList').items.length,0);
        assert.ok(h.all(d,'statictext').some(c=>/No parameters match/.test(c.text)));
        assert.equal(flagged(h,d,'listbox','fxPendingChanges').items.length,1);
        h.click(d,'Apply');
    };
    h.click(p,'Edit Parameters...');h.drain(p);assert.equal(props[0].value,21);assert.equal(props[1].value,80);
});
test('invalid input stays staged but prevents applying any pending parameter',()=>{
    const {h,p}=ready();
    h.dialogHooks['Edit Parameters']=d=>{
        numeric(h,d,'Exposure',20); numeric(h,d,'Radius','oops');
        assert.equal(flagged(h,d,'listbox','fxPendingChanges').items.length,2);
        assert.equal(h.all(d,'button').find(b=>b.fxTitle==='Apply').enabled,false);
        h.click(d,'Cancel');
    };
    h.click(p,'Edit Parameters...');assert.equal(h.calls.filter(c=>c[0]==='set').length,0);
});
test('initial Edit reads the selection then opens one editor on a separate scheduled callback',()=>{
    const h=ui(), e=example(h),p=h.start();h.scan(p);h.click(p,'Select Results');
    let opened=0;
    h.dialogHooks['Edit Parameters']=d=>{
        opened++;assert.equal(p.fxController.scanner.job,null);
        assert.equal(h.calls.filter(c=>c[0]==='set').length,0);h.click(d,'Cancel');
    };
    h.click(p,'Edit Parameters...');assert.equal(opened,0);h.drain(p);
    assert.equal(opened,1);assert.equal(h.tasks.size,0);h.drain(p);assert.equal(opened,1);
});
test('Apply leaves the same selection ready to reopen manually with updated values and blank pending edits',()=>{
    const {h,p,props}=ready();let opened=0;
    h.dialogHooks['Edit Parameters']=d=>{
        opened++;assert.equal(p.fxController.scanner.job,null);
        if(opened===1){numeric(h,d,'Radius',91);h.click(d,'Apply');}
        else {
            assert.equal(opened,2);assert.equal(props[1].value,91);
            const list=flagged(h,d,'listbox','fxParameterList');
            assert.equal(list.selection.text,'Radius');assert.equal(list.selection.subItems[0].text,'91');
            assert.ok(list.items.every(item=>!/^\* |^! /.test(item.text)));
            assert.equal(h.parameterFields(d)[0].text,'');
            assert.equal(flagged(h,d,'listbox','fxPendingChanges').items.length,0);
            h.click(d,'Cancel');
        }
    };
    h.click(p,'Edit Parameters...');h.drain(p);
    assert.equal(opened,1);assert.equal(p.fxController.editorTask(),null);
    assert.ok(h.all(p,'button').find(b=>b.text==='Edit Parameters...').enabled);
    h.click(p,'Edit Parameters...');
    assert.equal(opened,2);assert.equal(h.tasks.size,0);
    assert.equal(h.calls.filter(c=>c[0]==='set').length,1);
});
test('confirmation cancellation retains drafts without scheduling a continuation',()=>{
    const {h,p,props}=ready();h.setConfirm(false);
    h.dialogHooks['Edit Parameters']=d=>{numeric(h,d,'Radius',92);h.click(d,'Apply');};
    h.click(p,'Edit Parameters...');h.drain(p);assert.equal(props[1].value,80);assert.equal(h.tasks.size,0);
    h.dialogHooks['Edit Parameters']=d=>{choose(h,d,'Radius');assert.equal(h.parameterFields(d)[0].text,'92');h.click(d,'Cancel');};
    h.click(p,'Edit Parameters...');assert.equal(h.windows.filter(w=>w.text==='Edit Parameters').length,2);
});
test('a complete selected duplicate family can continue editing; no duplicate is omitted',()=>{
    const h=ui(),c=h.comp(),l=c.addLayer();l.parade.addProperty('ADBE Glo2');l.parade.addProperty('ADBE Glo2');
    const p=h.start();h.scan(p);h.click(p,'Select Results');h.read(p);h.drain(p);let opened=0;
    h.dialogHooks['Edit Parameters']=d=>{opened++;if(opened===1){numeric(h,d,'Intensity',11);h.click(d,'Apply');}else{h.click(d,'Cancel');}};
    h.click(p,'Edit Parameters...');h.drain(p);
    assert.equal(opened,1);h.click(p,'Edit Parameters...');
    assert.equal(opened,2);assert.equal(p.fxController.selected().instances.length,2);
    assert.deepEqual(l.parade.effects.map(e=>e.property(1).value),[11,11]);
});
test('clearing selection cancels a queued editor callback',()=>{
    const h=ui();example(h);const p=h.start();h.scan(p);h.click(p,'Select Results');
    h.click(p,'Edit Parameters...');
    while(p.fxController.scanner.job){const id=p.fxController.scanner.task,code=h.tasks.get(id);h.tasks.delete(id);vm.runInNewContext(code,h.$.global);}
    assert.ok(p.fxController.editorTask()!==null);h.click(p,'Clear Selection');h.drain(p);
    assert.equal(h.windows.filter(w=>w.text==='Edit Parameters').length,0);assert.equal(h.tasks.size,0);
});
test('host dropdown separators retain real indices and protected debug parameters are never read',()=>{
    const h=fixture(),e=example(h,{propertyParameters:['Screen','(-','Add']});
    const debug=h.prop('debug','', 'OneD',{name:'Debug Analysis Enable'});
    Object.defineProperty(debug,'value',{get(){throw Error('Internal value read');}});e.effect.children.push(debug);e.effect.numProperties++;
    const c=h.adapter.capture(e.effect), row=c.properties.find(r=>r.name==='Blend Mode');
    assert.deepEqual(plain(row.control.choices),[{value:1,label:'Screen'},{value:3,label:'Add'}]);
    assert.equal(c.properties.some(r=>r.name==='Debug Analysis Enable'),false);
    row.value=3;e.props[2].setPropertyParameters=()=>{throw Error('Never rewrite menu options');};
    const result=h.adapter.writeRows(e.effect,[row]);assert.equal(result.verified,1);assert.equal(e.props[2].value,3);
    for(const invalid of [2,1.5,99]){row.value=invalid;assert.throws(()=>h.adapter.writeRows(e.effect,[row]));}
});
test('menu option changes invalidate an existing batch before any writes',()=>{
    const h=fixture(),e=example(h),s=h.scan(),row=plain(s.instances[0].configuration.properties[2]);row.value=2;
    const plan=h.batch.preview(s.instances,'set',{rows:[row]});e.props[2].propertyParameters=['Add','Screen'];
    assert.throws(()=>h.batch.execute(plan),/changed|configuration|stale/i);assert.equal(h.calls.filter(c=>c[0]==='set').length,0);
});
test('Deep Glow fallback is scoped and refuses a changed index range',()=>{
    const h=fixture(),e=example(h,{propertyParameters:undefined});e.effect.matchName='Deep Glow 2';
    let c=h.adapter.capture(e.effect);assert.equal(c.properties[2].control.source,'deep-glow-2');
    e.props[2].hasMax=true;e.props[2].maxValue=4;c=h.adapter.capture(e.effect);
    assert.equal(c.properties.some(r=>r.name==='Blend Mode'),false);
    assert.ok(c.unsupported.some(r=>r.reason==='menu-labels-unavailable'));
    e.effect.matchName='Other Vendor';delete e.props[2].hasMax;c=h.adapter.capture(e.effect);
    assert.equal(c.properties[2].control,undefined);
});
test('known dropdowns without labels are unavailable while old host numeric controls still work',()=>{
    const h=fixture(),e=example(h,{propertyParameters:undefined,isDropdownEffect:true});
    let c=h.adapter.capture(e.effect);assert.equal(c.properties.length,2);assert.equal(c.unsupported[0].reason,'menu-labels-unavailable');
    Object.defineProperty(e.props[0],'propertyParameters',{get(){throw Error('Old host');}});
    Object.defineProperty(e.props[0],'isDropdownEffect',{get(){throw Error('Old host');}});
    c=h.adapter.capture(e.effect);assert.equal(c.properties[0].name,'Exposure');
});
test('incompatible menu maps across occurrences cannot be edited together',()=>{
    const h=fixture(),c=h.comp(),l=c.addLayer();
    const a=h.effect(l,'Other Vendor',0,[h.prop('Blend',1,'OneD',{propertyParameters:['Screen','Add']})]);
    const b=h.effect(l,'Other Vendor',0,[h.prop('Blend',1,'OneD',{propertyParameters:['Add','Screen']})]);
    const rows=h.FX.Presentation.editRows([{configuration:h.adapter.capture(a)},{configuration:h.adapter.capture(b)}]);
    assert.equal(rows[0].safe,false);assert.match(rows[0].guidance,/menu|option/i);
});
test('preset menu metadata roundtrips and malformed menu maps are rejected',()=>{
    const h=fixture(),e=example(h),row=h.adapter.capture(e.effect).properties[2];
    const doc={schemaVersion:1,product:'FX Exchanger Presets',presets:[{id:'menu',name:'Blend',matchName:'ADBE Glo2',omitted:0,rows:[row]}]};
    h.FX.Presets.validate(doc);h.FX.Presets.validate(h.FX.JSON.parse(h.FX.JSON.stringify(doc)));
    const invalid=plain(doc);invalid.presets[0].rows[0].control.choices[1].value=1;
    assert.throws(()=>h.FX.Presets.validate(invalid));
    const unknown=plain(doc);unknown.presets[0].rows[0].control.choices[0].code='executable';
    assert.throws(()=>h.FX.Presets.validate(unknown),/Unknown/);
});

for (const interruption of ['project', 'dispose', 'scan']) {
    test(interruption + ' cancels an editor requested after reading without any writes',()=>{
        const h=ui();example(h);const p=h.start();h.scan(p);h.click(p,'Select Results');h.click(p,'Edit Parameters...');
        while(p.fxController.scanner.job){const id=p.fxController.scanner.task,code=h.tasks.get(id);h.tasks.delete(id);vm.runInNewContext(code,h.$.global);}
        assert.notEqual(p.fxController.editorTask(),null);
        if(interruption==='project')h.app.project={numItems:0,items:[],activeItem:null};
        else if(interruption==='dispose')p.fxController.dispose();
        else {p.fxController.scan();}
        h.drain(p);
        assert.equal(h.windows.filter(w=>w.text==='Edit Parameters').length,0);
        assert.equal(h.calls.filter(c=>c[0]==='set').length,0);assert.equal(h.tasks.size,0);
    });
}
test('single parameter editor is compact and keyframe choice is contextual',()=>{
    const h=ui(),c=h.comp(),l=c.addLayer();l.parade.effects.push(h.effect(l,'ADBE Glo2',0,[h.prop('Intensity',5)]));
    const p=h.start();h.scan(p);h.click(p,'Select Results');h.read(p);h.drain(p);
    h.dialogHooks['Edit Parameters']=d=>{
        assert.equal(flagged(h,d,'listbox','fxParameterList').visible,false);
        assert.equal(flagged(h,d,'edittext','fxParameterSearch').parent.visible,false);
        assert.equal(flagged(h,d,'checkbox','fxRemoveAnimation').parent.visible,false);
        h.click(d,'Cancel');
    };h.click(p,'Edit Parameters...');
});
test('common numeric limits are intersected and exposed without changing units',()=>{
    const h=fixture(),c=h.comp(),l=c.addLayer();
    const a=h.effect(l,'Other Vendor',0,[h.prop('Amount',5,'OneD',{hasMin:true,minValue:0,hasMax:true,maxValue:10,unitsText:'%'})]);
    const b=h.effect(l,'Other Vendor',0,[h.prop('Amount',5,'OneD',{hasMin:true,minValue:2,hasMax:true,maxValue:8,unitsText:'%'})]);
    const rows=h.FX.Presentation.editRows([{configuration:h.adapter.capture(a)},{configuration:h.adapter.capture(b)}]);
    assert.equal(rows[0].row.control.min,2);assert.equal(rows[0].row.control.max,8);assert.equal(rows[0].row.control.units,'%');
    const row=plain(rows[0].row);row.value=9;assert.throws(()=>h.FX.Validate.rows([row]),/maximum/);
});

// Model a host which caches measured dimensions after relayout. This is not
// native visual QA: it exercises the zero-size state lost by the old mocks.
function cacheInputLayout(h, d, inputs = [...h.parameterFields(d), flagged(h,d,'dropdownlist','fxParameterMenu')]) {
    const dim = (size, name, index, fallback) => size && (size[name] ?? size[index]) !== undefined ?
        (size[name] ?? size[index]) : fallback;
    for (const input of inputs) input.preferredSize = [100, 26];
    d.layout.layout = () => {
        for (const input of inputs) {
            const width = Math.min(dim(input.maximumSize,'width',0,10000),
                Math.max(dim(input.minimumSize,'width',0,0),dim(input.preferredSize,'width',0,0)));
            const height = Math.min(dim(input.maximumSize,'height',1,10000),
                Math.max(dim(input.minimumSize,'height',1,0),dim(input.preferredSize,'height',1,0)));
            input.size = [width, height];
            input.preferredSize = [width, height];
        }
    };
    d.layout.layout(true);
}

function usableInput(input) {
    assert.ok(input.visible && input.enabled, 'The selected parameter input is visible and enabled');
    for (let parent = input.parent; parent; parent = parent.parent) {
        assert.notEqual(parent.visible, false, 'No ancestor hides the active input');
    }
    assert.ok(input.size[0] > 0 && input.size[1] >= 24, 'Relayout gives the input usable dimensions');
}

test('dropdown to numeric transitions restore a usable input after hidden controls were laid out', () => {
    const {h,p,props}=ready();
    h.dialogHooks['Edit Parameters']=d=>{
        choose(h,d,'Blend Mode');
        cacheInputLayout(h,d);
        const menu=flagged(h,d,'dropdownlist','fxParameterMenu');
        usableInput(menu);
        menu.selection=2;menu.onChange();
        choose(h,d,'Exposure');
        const input=h.parameterFields(d)[0];usableInput(input);
        input.text='20';input.onChanging();
        choose(h,d,'Blend Mode');usableInput(menu);assert.equal(menu.selection.text,'Add');
        choose(h,d,'Radius');usableInput(input);input.text='91';input.onChanging();
        choose(h,d,'Exposure');usableInput(input);assert.equal(input.text,'20');
        h.click(d,'Apply');
    };
    h.click(p,'Edit Parameters...');h.drain(p);
    assert.deepEqual(props.map(p=>p.value),[20,91,2]);
    assert.equal(h.calls.filter(c=>c[0]==='set').length,3);
});

test('hidden vector components and an empty search recover usable dimensions without losing drafts', () => {
    const h=ui(),c=h.comp(),l=c.addLayer();
    const props=[h.prop('Mode',1,'OneD',{propertyParameters:['Screen','Add']}),
        h.prop('Point',[1,2],'TwoD'),h.prop('Position',[1,2,3],'ThreeD'),h.prop('Tint',[1,1,1,1],'COLOR')];
    l.parade.effects.push(h.effect(l,'ADBE Glo2',0,props));
    const p=h.start();h.scan(p);h.click(p,'Select Results');h.read(p);h.drain(p);
    h.dialogHooks['Edit Parameters']=d=>{
        cacheInputLayout(h,d);
        const fields=h.parameterFields(d);
        for(const [name,values] of [['Point',[3,4]],['Position',[5,6,7]],['Tint',[0.1,0.2,0.3,1]]]) {
            choose(h,d,name);
            values.forEach((value,index)=>{usableInput(fields[index]);fields[index].text=String(value);fields[index].onChanging();});
        }
        const search=flagged(h,d,'edittext','fxParameterSearch');search.text='no such parameter';search.onChanging();
        search.text='';search.onChanging();choose(h,d,'Point');
        usableInput(fields[0]);usableInput(fields[1]);
        assert.equal(fields[0].text,'3');assert.equal(fields[1].text,'4');
        assert.equal(fields[2].visible,false);assert.equal(fields[3].visible,false);
        h.click(d,'Apply');
    };
    h.click(p,'Edit Parameters...');h.drain(p);
    assert.deepEqual(props.map(p=>plain(p.value)),[1,[3,4],[5,6,7],[0.1,0.2,0.3,1]]);
});

test('editor offers a single Apply and explains how to continue editing', () => {
    const {h,p}=ready();
    h.dialogHooks['Edit Parameters']=d=>{
        assert.ok(h.all(d,'statictext').some(c=>/To make more changes, use Edit Parameters again/.test(c.text)));
        assert.equal(h.all(d,'button').filter(b=>/^Apply/.test(b.text)).length,1);
        assert.match(h.all(d,'button').find(b=>b.fxTitle==='Apply').helpTip,/stays ready/);
        h.click(d,'Cancel');
    };
    h.click(p,'Edit Parameters...');
    assert.equal(h.calls.filter(c=>c[0]==='set').length,0);
});

test('preset menu and number editors remain usable when switching without writing the project', () => {
    let doc={schemaVersion:1,product:'FX Exchanger Presets',presets:[]};
    const store={load:()=>plain(doc),save:value=>{doc=plain(value);}};
    const h=ui({presetStore:store}),e=example(h);
    new h.FX.Presets.Library(store).save('Mixed controls','ADBE Glo2',h.adapter.capture(e.effect).properties,0);
    const p=h.start();let opened=0;
    h.dialogHooks['Effect presets']=d=>{if(opened++===0)h.click(d,'Edit values...');else h.click(d,'Close');};
    h.dialogHooks['Edit preset']=d=>{
        const list=h.all(d,'listbox')[0],number=h.all(d,'edittext')[0],menu=flagged(h,d,'dropdownlist','fxPresetMenu');
        list.selection=2;list.onChange();cacheInputLayout(h,d,[number,menu]);usableInput(menu);
        list.selection=0;list.onChange();d.layout.layout(true);usableInput(number);number.text='21';
        h.click(d,'Save preset');
    };
    h.click(p,'Presets...');
    assert.equal(doc.presets[0].rows[0].value,21);
    assert.equal(e.props[0].value,5);assert.equal(h.calls.filter(c=>c[0]==='set').length,0);
    assert.equal(h.alerts.length,0);
});

test('pending markers follow numeric and menu drafts through filtering and clearing', () => {
    const {h,p}=ready({selectionNotifications:'always'});
    h.dialogHooks['Edit Parameters']=d=>{
        const list=flagged(h,d,'listbox','fxParameterList');
        numeric(h,d,'Exposure',20);
        assert.equal(list.items[0].text,'* Exposure');
        assert.ok(h.all(d,'statictext').some(c=>c.text==='Exposure - Pending change'));
        choose(h,d,'Blend Mode');const menu=flagged(h,d,'dropdownlist','fxParameterMenu');
        menu.selection=2;menu.onChange();assert.equal(list.selection.text,'* Blend Mode');
        const search=flagged(h,d,'edittext','fxParameterSearch');search.text='radius';search.onChanging();
        assert.equal(flagged(h,d,'listbox','fxPendingChanges').items.length,2);
        search.text='';search.onChanging();
        assert.deepEqual(list.items.map(item=>item.text),['* Exposure','Radius','* Blend Mode']);
        choose(h,d,'Exposure');h.click(d,'Clear this change');assert.equal(list.items[0].text,'Exposure');
        h.click(d,'Clear all changes');
        assert.deepEqual(list.items.map(item=>item.text),['Exposure','Radius','Blend Mode']);
        assert.equal(h.all(d,'button').find(b=>b.fxTitle==='Apply').enabled,false);
        h.click(d,'Cancel');
    };
    h.click(p,'Edit Parameters...');assert.equal(h.notifications.overflow,0);
    assert.equal(h.calls.filter(c=>c[0]==='set').length,0);
});

test('invalid markers distinguish errors from valid pending changes and persist on navigation', () => {
    const {h,p}=ready();
    h.dialogHooks['Edit Parameters']=d=>{
        const list=flagged(h,d,'listbox','fxParameterList');
        numeric(h,d,'Exposure','oops');assert.equal(list.selection.text,'! Exposure');
        choose(h,d,'Radius');choose(h,d,'Exposure');
        assert.ok(h.all(d,'statictext').some(c=>c.text==='Exposure - Invalid value'));
        assert.match(flagged(h,d,'listbox','fxPendingChanges').items[0].subItems[1].text,/Invalid value/);
        const input=h.parameterFields(d)[0];input.text='21';input.onChanging();
        assert.equal(list.selection.text,'* Exposure');
        assert.ok(h.all(d,'statictext').some(c=>c.text==='Exposure - Pending change'));
        assert.equal(h.all(d,'button').find(b=>b.fxTitle==='Apply').enabled,true);
        input.text='';input.onChanging();assert.equal(list.selection.text,'Exposure');
        assert.equal(flagged(h,d,'listbox','fxPendingChanges').items.length,0);
        h.click(d,'Cancel');
    };
    h.click(p,'Edit Parameters...');assert.equal(h.calls.filter(c=>c[0]==='set').length,0);
});

test('native label notifications cannot change selection or corrupt values while refreshing pending markers', () => {
    const {h,p,props}=ready();
    h.dialogHooks['Edit Parameters']=d=>{
        const list=flagged(h,d,'listbox','fxParameterList'), item=list.items[0];
        let text=item.text,notifications=0;
        Object.defineProperty(item,'text',{get:()=>text,set:value=>{text=value;notifications++;list.onChange();}});
        numeric(h,d,'Exposure',20);assert.equal(list.selection,item);
        assert.equal(h.parameterFields(d)[0].text,'20');assert.equal(notifications,1);
        assert.equal(flagged(h,d,'listbox','fxPendingChanges').items.length,1);
        h.click(d,'Apply');
    };
    h.click(p,'Edit Parameters...');h.drain(p);
    assert.deepEqual(props.map(prop=>prop.value),[20,80,1]);
    assert.equal(h.calls.filter(c=>c[0]==='set').length,1);assert.equal(h.alerts.length,0);
});
