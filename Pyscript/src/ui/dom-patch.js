function syncAttributes(currentNode, nextNode) {
  const preserveDetailsOpen = currentNode instanceof HTMLDetailsElement && nextNode instanceof HTMLDetailsElement;
  const currentAttributes = [...currentNode.attributes];
  const nextAttributes = [...nextNode.attributes];

  for (const attribute of currentAttributes) {
    if (preserveDetailsOpen && attribute.name === "open") {
      continue;
    }
    if (!nextNode.hasAttribute(attribute.name)) {
      currentNode.removeAttribute(attribute.name);
    }
  }

  for (const attribute of nextAttributes) {
    if (preserveDetailsOpen && attribute.name === "open") {
      continue;
    }
    if (currentNode.getAttribute(attribute.name) !== attribute.value) {
      currentNode.setAttribute(attribute.name, attribute.value);
    }
  }

  if (currentNode instanceof HTMLInputElement && nextNode instanceof HTMLInputElement) {
    if (currentNode.type === "checkbox" || currentNode.type === "radio") {
      if (currentNode.checked !== nextNode.checked) {
        currentNode.checked = nextNode.checked;
      }
    } else if (currentNode.value !== nextNode.value) {
      currentNode.value = nextNode.value;
    }
  }

  if (currentNode instanceof HTMLTextAreaElement && nextNode instanceof HTMLTextAreaElement) {
    if (currentNode.value !== nextNode.value) {
      currentNode.value = nextNode.value;
    }
  }

  if (currentNode instanceof HTMLSelectElement && nextNode instanceof HTMLSelectElement) {
    if (currentNode.value !== nextNode.value) {
      currentNode.value = nextNode.value;
    }
  }
}

function morphNode(currentNode, nextNode) {
  if (!currentNode && nextNode) {
    return nextNode.cloneNode(true);
  }

  if (currentNode && !nextNode) {
    currentNode.remove();
    return null;
  }

  if (!currentNode || !nextNode) {
    return currentNode;
  }

  if (currentNode.nodeType !== nextNode.nodeType) {
    const replacement = nextNode.cloneNode(true);
    currentNode.replaceWith(replacement);
    return replacement;
  }

  if (currentNode.nodeType === Node.TEXT_NODE || currentNode.nodeType === Node.COMMENT_NODE) {
    if (currentNode.nodeValue !== nextNode.nodeValue) {
      currentNode.nodeValue = nextNode.nodeValue;
    }
    return currentNode;
  }

  if (currentNode.nodeName !== nextNode.nodeName) {
    const replacement = nextNode.cloneNode(true);
    currentNode.replaceWith(replacement);
    return replacement;
  }

  syncAttributes(currentNode, nextNode);

  const currentChildren = [...currentNode.childNodes];
  const nextChildren = [...nextNode.childNodes];
  const maxLength = Math.max(currentChildren.length, nextChildren.length);

  for (let index = 0; index < maxLength; index += 1) {
    const currentChild = currentChildren[index];
    const nextChild = nextChildren[index];

    if (!currentChild && nextChild) {
      currentNode.appendChild(nextChild.cloneNode(true));
      continue;
    }

    if (currentChild && !nextChild) {
      currentChild.remove();
      continue;
    }

    morphNode(currentChild, nextChild);
  }

  return currentNode;
}

export function patchHtml(target, html) {
  const template = document.createElement("template");
  template.innerHTML = html;

  const currentChildren = [...target.childNodes];
  const nextChildren = [...template.content.childNodes];
  const maxLength = Math.max(currentChildren.length, nextChildren.length);

  for (let index = 0; index < maxLength; index += 1) {
    const currentChild = currentChildren[index];
    const nextChild = nextChildren[index];

    if (!currentChild && nextChild) {
      target.appendChild(nextChild.cloneNode(true));
      continue;
    }

    if (currentChild && !nextChild) {
      currentChild.remove();
      continue;
    }

    morphNode(currentChild, nextChild);
  }
}
