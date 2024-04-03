use jrsonnet_stdlib::{builtin_type, Settings};
use std::{cell::{Ref, RefCell, RefMut}, collections::HashMap, rc::Rc};

use jrsonnet_evaluator::{
    error::ErrorKind::{self, ImportSyntaxError}, function::{builtin::{ NativeCallback, NativeCallbackHandler}, FuncVal, TlaArg}, stdlib, tb, trace::PathResolver, ContextBuilder, ContextInitializer, Error, ObjValue, ObjValueBuilder, Result, State, Thunk, Val,
    function::builtin,
};
use jrsonnet_gcmodule::Trace;
use jrsonnet_parser::{IStr, Source};
use jrsonnet_stdlib::{StdTracePrinter, TracePrinter};



// Implement NativeCallbackHandler for your native function

#[builtin]
fn join(a: String, b: String) -> String {
    format!("{}{}", a, b)
}

#[builtin]
fn regex_match(a: String, b: String) -> Vec<String> {
    // log(&a);
    // log(&b);
    let re = regex::Regex::new(&b).unwrap();
    let mut matches = Vec::new();
    for cap in re.captures_iter(&a) {
        if cap.len() == 0 {
            continue;
        }
        if cap.len() == 1 {
            matches.push(cap[0].to_string());
            continue;
        }
        matches.push(cap[1].to_string());
    }
    if matches.len() == 0 {
        matches.push("".to_string());
    }
    matches
}

fn arakoolib_uncached() -> ObjValue {
    let mut builder = ObjValueBuilder::new();
    builder.method("join", join::INST);
    builder.method("regexMatch", regex_match::INST);
    builder.build()
}

#[derive(Trace, Clone)]
pub struct ArakooContextInitializer {
    /// When we don't need to support legacy-this-file, we can reuse same context for all files
    context: jrsonnet_evaluator::Context,
    /// For `populate`
    stdlib_thunk: Thunk<Val>,
    arakoolib_thunk: Thunk<Val>,
    settings: Rc<RefCell<jrsonnet_stdlib::Settings>>,
}

fn extvar_source(name: &str, code: impl Into<IStr>) -> Source {
	let source_name = format!("<extvar:{name}>");
	Source::new_virtual(source_name.into(), code.into())
}

impl ArakooContextInitializer {
    pub fn new(_s: State, resolver: PathResolver) -> Self {
        let settings = jrsonnet_stdlib::Settings {
            ext_vars: Default::default(),
            ext_natives: Default::default(),
            trace_printer: Box::new(StdTracePrinter::new(resolver.clone())),
            path_resolver: resolver,
        };
        let settings = Rc::new(RefCell::new(settings));
        let stdlib_obj = jrsonnet_stdlib::stdlib_uncached(settings.clone());
        
        let stdlib_thunk = Thunk::evaluated(Val::Obj(stdlib_obj));
        let arakoolib_obj = arakoolib_uncached();
        let arakoolib_thunk = Thunk::evaluated(Val::Obj(arakoolib_obj));
        Self {
            context: {
                let mut context = ContextBuilder::with_capacity(_s, 1);
                context.bind("std", stdlib_thunk.clone());
                context.bind("arakoo", arakoolib_thunk.clone());
                context.build()
            },
            stdlib_thunk,
            arakoolib_thunk,
            settings,
        }
    }
    pub fn settings(&self) -> Ref<Settings> {
        self.settings.borrow()
    }
    pub fn settings_mut(&self) -> RefMut<Settings> {
        self.settings.borrow_mut()
    }
    pub fn add_ext_var(&self, name: IStr, value: Val) {
        self.settings_mut()
            .ext_vars
            .insert(name, TlaArg::Val(value));
    }
    pub fn add_ext_str(&self, name: IStr, value: IStr) {
        self.settings_mut()
            .ext_vars
            .insert(name, TlaArg::String(value));
    }
    pub fn add_ext_code(&self, name: &str, code: impl Into<IStr>) -> Result<()> {
        let code = code.into();
        let source = extvar_source(name, code.clone());
        let parsed = jrsonnet_parser::parse(
            &code,
            &jrsonnet_parser::ParserSettings {
                source: source.clone(),
            },
        )
        .map_err(|e| ImportSyntaxError {
            path: source,
            error: Box::new(e),
        })?;
        // self.data_mut().volatile_files.insert(source_name, code);
        self.settings_mut()
            .ext_vars
            .insert(name.into(), TlaArg::Code(parsed));
        Ok(())
    }
    pub fn add_native(&self, name: impl Into<IStr>, cb: impl Into<FuncVal>) {
        self.settings_mut()
            .ext_natives
            .insert(name.into(), cb.into());
    }
}

impl jrsonnet_evaluator::ContextInitializer for ArakooContextInitializer {
    fn reserve_vars(&self) -> usize {
        1
    }
    
    fn initialize(&self, _s: State, _source: Source) -> jrsonnet_evaluator::Context {
        self.context.clone()
    }
    
    fn populate(&self, _for_file: Source, builder: &mut ContextBuilder) {
        builder.bind("std", self.stdlib_thunk.clone());
        builder.bind("arakoo", self.arakoolib_thunk.clone());
    }
    fn as_any(&self) -> &dyn std::any::Any {
        self
    }
}
