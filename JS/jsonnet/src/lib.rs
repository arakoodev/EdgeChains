use jrsonnet_evaluator::{
    apply_tla,
    function::{builtin, TlaArg},
    gc::GcHashMap,
    manifest::{JsonFormat, ManifestFormat},
    tb,
    trace::{CompactFormat, PathResolver, TraceFormat},
    FileImportResolver, ObjValueBuilder, State, Thunk, Val,
};
use jrsonnet_parser::IStr;
use wasm_bindgen::prelude::*;

#[wasm_bindgen(module = "/read-file.js")]
extern "C" {
    #[wasm_bindgen(catch)]
    fn read_file(path: &str) -> Result<String, JsValue>;
}

// console log
#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);
}

pub struct VM {
    state: State,
    manifest_format: Box<dyn ManifestFormat>,
    trace_format: Box<dyn TraceFormat>,
    tla_args: GcHashMap<IStr, TlaArg>,
}

#[wasm_bindgen]
pub fn jsonnet_make() -> *mut VM {
    let state = State::default();
    state.settings_mut().import_resolver = tb!(FileImportResolver::default());
    state.settings_mut().context_initializer = tb!(jrsonnet_stdlib::ContextInitializer::new(
        state.clone(),
        PathResolver::new_cwd_fallback(),
    ));
    // add_namespace(&state);
    Box::into_raw(Box::new(VM {
        state,
        manifest_format: Box::new(JsonFormat::default()),
        trace_format: Box::new(CompactFormat::default()),
        tla_args: GcHashMap::default(),
    }))
}

#[wasm_bindgen]
pub fn jsonnet_destroy(vm: *mut VM) {
    unsafe {
        let dloc_vm = Box::from_raw(vm);
        drop(dloc_vm);
    }
}

#[wasm_bindgen]
pub fn jsonnet_evaluate_snippet(vm: *mut VM, filename: &str, snippet: &str) -> String {
    let vm = unsafe { &mut *vm };
    match vm
        .state
        .evaluate_snippet(filename, snippet)
        .and_then(|val| apply_tla(vm.state.clone(), &vm.tla_args, val))
        .and_then(|val| val.manifest(&vm.manifest_format))
    {
        Ok(v) => v,
        Err(e) => {
            let mut out = String::new();
            vm.trace_format.write_trace(&mut out, &e).unwrap();
            out
        }
    }
}

#[wasm_bindgen]
pub fn jsonnet_evaluate_file(vm: *mut VM, filename: &str) -> String {
    let vm = unsafe { &mut *vm };
    match read_file(filename) {
        Ok(content) => match vm
            .state
            .evaluate_snippet(filename, &content)
            .and_then(|val| apply_tla(vm.state.clone(), &vm.tla_args, val))
            .and_then(|val| val.manifest(&vm.manifest_format))
        {
            Ok(v) => v,
            Err(e) => {
                let mut out = String::new();
                vm.trace_format.write_trace(&mut out, &e).unwrap();
                out
            }
        },
        Err(e) => {
            eprintln!("Error reading file: {}", e.as_string().unwrap());
            let out = String::from(e.as_string().unwrap());
            out
        }
    }
}

#[wasm_bindgen]
pub fn ext_string(vm: *mut VM, key: &str, value: &str) {
    let vm = unsafe { &mut *vm };
    let any_initializer = vm.state.context_initializer();
    any_initializer
        .as_any()
        .downcast_ref::<jrsonnet_stdlib::ContextInitializer>()
        .expect("only stdlib context initializer supported")
        .add_ext_var(key.into(), Val::Str(value.into()));
}

fn add_namespace(state: &State) {
    let mut bobj = ObjValueBuilder::new();
    bobj.method("join", join::INST);
    bobj.method("regexMatch", regex_match::INST);
    state.add_global("arakoo".into(), Thunk::evaluated(Val::Obj(bobj.build())))
}

#[builtin]
fn join(a: String, b: String) -> String {
    format!("{}{}", a, b)
}

#[builtin]
fn regex_match(a: String, b: String) -> Vec<String> {
    log(&a);
    log(&b);
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

#[cfg(test)]
mod test {
    use super::*;
    use regex::Regex;
    #[test]
    // #[wasm_bindgen]
    pub fn test() {
        let vm = jsonnet_make();
        // let filename = CString::new("filename").unwrap();
        let filename = "filename";

        let snippet = r#"
    local username = std.extVar('name');
    local Person(name='Alice') = {
      name: name,
      welcome: 'Hello ' + name + '!',
    };
    {
      person1: Person(username),
      person2: Person('Bob'),
    }"#;

        // .unwrap();
        unsafe {
            ext_string(
                &mut *vm, // name.as_ptr() as *const c_char,
                "name",   // value.as_ptr() as *const c_char,
                "afshan",
            );
        }

        let result = unsafe { jsonnet_evaluate_snippet(&mut *vm, filename, snippet) };
        println!("{}", result);
        // }
    }

    #[test]
    fn do_regex_test() {
        let hay = r"Question: Which magazine was started first Arthur's Magazine or First for Women?
        Thought 1: I need to search Arthur's Magazine and First for Women, and find which was
        started first.
        Action 1: Search[Arthur's Magazine]
        Observation 1: Arthur's Magazine (1844-1846) was an American literary periodical published
        in Philadelphia in the 19th century.
        Thought 2: Arthur's Magazine was started in 1844. I need to search First for Women
        next.
        Action 2: Search[First for Women]";
        // get words in Search[]
        let re = Regex::new(r"Observation 1: (.*)\.").unwrap();

        let mut search = Vec::new();
        for cap in re.captures_iter(hay) {
            search.push(cap[1].to_string());
        }

        println!("pattern found {:?}", search);
    }

}
