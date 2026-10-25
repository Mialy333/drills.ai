"""One output-language policy shared by candidate workflows."""
def language_instruction(language: str) -> str:
    target = 'French (français)' if language == 'fr' else 'English'
    return (f'OUTPUT LANGUAGE: {target}. Every human-readable heading, explanation, observation, '
            'next action, question and draft sentence MUST be entirely in this language, even when '
            'the profile, posting or transcript uses another language. Do not mix translated prose '
            'with English section labels in French output. Keep JSON keys unchanged. Preserve exact '
            'source references, proper names, company names, product names and technical acronyms. '
            'Before returning, check the language of every human-readable field. ')
