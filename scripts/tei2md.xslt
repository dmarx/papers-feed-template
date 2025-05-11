<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0" 
    xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
    xmlns:tei="http://www.tei-c.org/ns/1.0">

  <!-- Output as plain text (Markdown) using UTF-8 encoding -->
  <xsl:output method="text" encoding="UTF-8"/>
  <xsl:strip-space elements="*"/>

  <!-- Root template: Process title, abstract, then body -->
  <xsl:template match="/">
      <xsl:apply-templates select="//tei:titleStmt"/>
      <xsl:text>&#xa;&#xa;</xsl:text>
      <xsl:apply-templates select="//tei:abstract"/>
      <xsl:text>&#xa;&#xa;</xsl:text>
      <xsl:apply-templates select="//tei:body"/>
  </xsl:template>

  <!-- Title and Authors -->
  <xsl:template match="tei:titleStmt">
      <xsl:text># </xsl:text>
      <xsl:value-of select="normalize-space(tei:title)"/>
      <xsl:text>&#xa;&#xa;</xsl:text>
      <xsl:for-each select="tei:author">
          <xsl:value-of select="normalize-space(tei:persName)"/>
          <xsl:if test="position() != last()">, </xsl:if>
      </xsl:for-each>
      <xsl:text>&#xa;</xsl:text>
  </xsl:template>

  <!-- Abstract -->
  <xsl:template match="tei:abstract">
      <xsl:text>## Abstract&#xa;&#xa;</xsl:text>
      <xsl:apply-templates/>
      <xsl:text>&#xa;</xsl:text>
  </xsl:template>

  <!-- Sections (tei:div) -->
  <!-- Only output a heading if a head element exists and is nonempty -->
  <xsl:template match="tei:div">
      <xsl:text>&#xa;</xsl:text>
      <xsl:choose>
          <xsl:when test="ancestor::tei:div">### </xsl:when>
          <xsl:otherwise>## </xsl:otherwise>
      </xsl:choose>
      <xsl:if test="tei:head and normalize-space(tei:head) != ''">
          <xsl:value-of select="normalize-space(tei:head)"/>
      </xsl:if>
      <xsl:text>&#xa;&#xa;</xsl:text>
      <xsl:apply-templates select="*[not(self::tei:head)]"/>
  </xsl:template>

  <!-- Paragraphs -->
  <xsl:template match="tei:p">
      <xsl:apply-templates/>
      <xsl:text>&#xa;&#xa;</xsl:text>
  </xsl:template>

  <!-- Lists -->
  <xsl:template match="tei:list">
      <xsl:text>&#xa;</xsl:text>
      <xsl:apply-templates/>
  </xsl:template>

  <xsl:template match="tei:item">
      <xsl:text>* </xsl:text>
      <xsl:apply-templates/>
      <xsl:text>&#xa;</xsl:text>
  </xsl:template>

  <!-- Inline Formatting -->
  <xsl:template match="tei:hi[@rend='italic']">
      <xsl:text>*</xsl:text>
      <xsl:apply-templates/>
      <xsl:text>*</xsl:text>
  </xsl:template>

  <xsl:template match="tei:hi[@rend='bold']">
      <xsl:text>**</xsl:text>
      <xsl:apply-templates/>
      <xsl:text>**</xsl:text>
  </xsl:template>

  <!-- References -->
  <!-- If the target attribute is missing, insert a '#' as a fallback -->
  <xsl:template match="tei:ref">
      <xsl:text>[</xsl:text>
      <xsl:apply-templates/>
      <xsl:text>](</xsl:text>
      <xsl:choose>
        <xsl:when test="@target">
          <xsl:value-of select="@target"/>
        </xsl:when>
        <xsl:otherwise>
          <xsl:text>#</xsl:text>
        </xsl:otherwise>
      </xsl:choose>
      <xsl:text>)</xsl:text>
  </xsl:template>

  <!-- Figures -->
  <xsl:template match="tei:figure">
      <xsl:text>![</xsl:text>
      <xsl:value-of select="normalize-space(tei:figDesc)"/>
      <xsl:text>](</xsl:text>
      <xsl:value-of select="tei:graphic/@url"/>
      <xsl:text>)&#xa;&#xa;</xsl:text>
  </xsl:template>

  <!-- Tables -->
  <xsl:template match="tei:table">
      <xsl:apply-templates select="tei:row"/>
      <xsl:text>&#xa;</xsl:text>
  </xsl:template>

  <xsl:template match="tei:row">
      <xsl:text>|</xsl:text>
      <xsl:apply-templates select="tei:cell"/>
      <xsl:text>&#xa;</xsl:text>
      <xsl:if test="position() = 1">
          <xsl:text>|</xsl:text>
          <xsl:for-each select="tei:cell">
              <xsl:text>---|</xsl:text>
          </xsl:for-each>
          <xsl:text>&#xa;</xsl:text>
      </xsl:if>
  </xsl:template>

  <xsl:template match="tei:cell">
      <xsl:text> </xsl:text>
      <xsl:apply-templates/>
      <xsl:text> |</xsl:text>
  </xsl:template>

  <!-- Formulas: Preserve formulas by wrapping their content in inline math delimiters.
       We use normalize-space(.) to remove extraneous whitespace at the edges,
       but preserve the content in between. Adjust as needed if your formulas are block-level. -->
  <xsl:template match="tei:formula">
      <xsl:text>$</xsl:text>
      <xsl:value-of select="normalize-space(.)"/>
      <xsl:text>$</xsl:text>
  </xsl:template>

  <!-- Catch-all: Process any elements not explicitly matched by applying their children -->
  <xsl:template match="*">
      <xsl:apply-templates/>
  </xsl:template>

</xsl:stylesheet>
