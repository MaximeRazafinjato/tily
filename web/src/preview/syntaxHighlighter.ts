import hljs from 'highlight.js/lib/common'
import dos from 'highlight.js/lib/languages/dos'
import powershell from 'highlight.js/lib/languages/powershell'

hljs.registerLanguage('powershell', powershell)
hljs.registerLanguage('dos', dos)

export { hljs }
