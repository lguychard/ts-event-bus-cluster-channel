interface Configuration {
    entities: Entity[]
}

/**
 * Defines a new hoverable entity
 */

interface Entity {
    /**
     * Readable name for the entity to be displayed in hover tooltip,
     * eg. 'string literal' or 'HTTP request'
     */
    name: string

    definition: SearchAndCapturePatterns[]
    reference: SearchAndCapturePatterns[]
    implementation: SearchAndCapturePatterns[]
}

interface SearchAndCapturePatterns {
    /**
     * A RegExp pattern to be matched against the hovered line when viewing code.
     * If the RegExp matches, a hover tooltip will be shown, highlighting the whole
     * RegExp match. The RegExp may include capture groups, whose values are to be
     * injected in search queries
     *
     * example:
     */
    capture?: string

    /**
     * A search pattern used to find occurences using the Sourcegraph code search.
     *
     * Can reference capture groups from {@link SearchAndCapturePatterns.capture} as $1...$n,
     * in which case the placeholders will be replaced by the values captured on hover
     *
     * example: "http.Post(\"$1\")"
     */
    search?: string

    /**
     * An optional filename pattern to further filter results
     *
     * example: "\.go"
     */
    file?: string
}
