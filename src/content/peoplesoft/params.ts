import { type SearchContext, decodeEntities } from "./shared";

export function buildSearchParams(
  context: SearchContext,
  classNumber: string,
  career: string
): URLSearchParams {
  const params = new URLSearchParams(context.baseParams.toString());

  params.set("ICAJAX", "1");
  params.set("ICAction", "CLASS_SRCH_WRK2_SSR_PB_CLASS_SRCH");
  params.set("ICResubmit", "0");
  params.set("ICChanged", "-1");
  params.set("ICActionPrompt", "false");
  params.set("ICBcDomData", "UnknownValue");
  params.set("ICPanelHelpUrl", "");
  params.set("ICPanelName", "");
  params.set("ICFind", "");
  params.set("ICAddCount", "");
  params.set("ICAppClsData", "");
  setAllFieldsWithPrefix(params, "SSR_CLSRCH_WRK_CLASS_NBR", classNumber);
  params.set(context.classFieldName, classNumber);
  setAllFieldsWithPrefix(params, "SSR_CLSRCH_WRK_CATALOG_NBR", "");
  setAllFieldsWithPrefix(params, "SSR_CLSRCH_WRK_DESCR", "");
  setAllFieldsWithPrefix(params, "SSR_CLSRCH_WRK_LAST_NAME", "");
  setAllFieldsWithPrefix(params, "SSR_CLSRCH_WRK_SUBJECT_SRCH", "");
  setAllFieldsWithPrefix(params, "SSR_CLSRCH_WRK_SSR_OPEN_ONLY$chk$", "N");
  setAllFieldsWithPrefix(params, "SSR_CLSRCH_WRK_ACAD_CAREER", career);
  params.set(context.careerFieldName, career);

  return params;
}

export function buildDetailParams(searchResponseText: string, actionId: string): URLSearchParams {
  const params = extractHiddenInputs(searchResponseText);
  if (!params.has("ICSID")) {
    throw new Error("Unable to prepare class detail request (missing hidden state).");
  }

  params.set("ICAJAX", "1");
  params.set("ICNAVTYPEDROPDOWN", "0");
  params.set("ICAction", actionId);
  params.set("ICResubmit", "0");
  params.set("ICActionPrompt", "false");
  params.set("ICBcDomData", "UnknownValue");
  params.set("ICPanelHelpUrl", "");
  params.set("ICPanelName", "");
  params.set("ICFind", "");
  params.set("ICAddCount", "");
  params.set("ICAppClsData", "");
  if (!params.has("DERIVED_SSTSNAV_SSTS_MAIN_GOTO$27$")) {
    params.set("DERIVED_SSTSNAV_SSTS_MAIN_GOTO$27$", "");
  }

  return params;
}

export function extractHiddenInputs(responseText: string): URLSearchParams {
  const params = new URLSearchParams();
  const hiddenInputRegex =
    /<input[^>]*type=['"]hidden['"][^>]*name=['"]([^'"]+)['"][^>]*value=['"]([^'"]*)['"][^>]*>/gi;

  let match: RegExpExecArray | null;
  while ((match = hiddenInputRegex.exec(responseText)) !== null) {
    const name = decodeEntities(match[1] ?? "");
    const value = decodeEntities(match[2] ?? "");
    if (!name) continue;
    params.set(name, value);
  }

  return params;
}

function setAllFieldsWithPrefix(
  params: URLSearchParams,
  fieldPrefix: string,
  value: string
): void {
  const keys = new Set<string>();
  params.forEach((_v, key) => {
    keys.add(key);
  });
  for (const key of Array.from(keys)) {
    if (!key.startsWith(fieldPrefix)) continue;
    params.set(key, value);
  }
}

export function buildActionParams(baseParams: URLSearchParams, actionId: string): URLSearchParams {
  const params = new URLSearchParams(baseParams.toString());
  params.set("ICAJAX", "1");
  params.set("ICNAVTYPEDROPDOWN", "0");
  params.set("ICType", "Panel");
  params.set("ICElementNum", "0");
  params.set("ICAction", actionId);
  params.set("ICModelCancel", "0");
  params.set("ICXPos", "0");
  params.set("ICYPos", "0");
  params.set("ResponsetoDiffFrame", "-1");
  params.set("TargetFrameName", "None");
  params.set("FacetPath", "None");
  params.set("PrmtTbl", "");
  params.set("PrmtTbl_fn", "");
  params.set("PrmtTbl_fv", "");
  params.set("TA_SkipFldNms", "");
  params.set("ICFocus", "");
  params.set("ICSaveWarningFilter", "0");
  params.set("ICChanged", "0");
  params.set("ICSkipPending", "0");
  params.set("ICAutoSave", "0");
  params.set("ICResubmit", "0");
  params.set("ICActionPrompt", "false");
  params.set("ICFind", "");
  params.set("ICAddCount", "");
  params.set("ICAppClsData", "");
  return params;
}

export function applyResponseState(baseParams: URLSearchParams, responseText: string): URLSearchParams {
  const params = new URLSearchParams(baseParams.toString());

  const parsedStateNum = responseText.match(/ICStateNum\.value\s*=\s*'?(\d+)'?/i)?.[1] ?? null;
  if (parsedStateNum) {
    params.set("ICStateNum", parsedStateNum);
  }

  const hiddenValues = extractHiddenInputs(responseText);
  hiddenValues.forEach((value, key) => {
    params.set(key, value);
  });

  return params;
}

export function serializeForm(form: HTMLFormElement): URLSearchParams {
  const params = new URLSearchParams();

  for (const element of Array.from(form.elements)) {
    if (
      !(
        element instanceof HTMLInputElement ||
        element instanceof HTMLSelectElement ||
        element instanceof HTMLTextAreaElement
      )
    ) {
      continue;
    }

    if (!element.name || element.disabled) continue;

    if (element instanceof HTMLInputElement) {
      const type = element.type.toLowerCase();
      if (type === "button" || type === "submit" || type === "reset" || type === "image") continue;

      if (type === "radio") {
        if (element.checked) params.set(element.name, element.value);
        continue;
      }

      if (type === "checkbox") {
        if (element.checked) {
          params.set(element.name, element.value || "Y");
        } else if (element.name.includes("$chk")) {
          params.set(element.name, "");
        }
        continue;
      }
    }

    params.set(element.name, element.value ?? "");
  }

  return params;
}
