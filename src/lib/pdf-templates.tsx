import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";
import type { TailoringResult } from "./schema";

const styles = StyleSheet.create({
  page: {
    paddingTop: 32,
    paddingBottom: 30,
    paddingHorizontal: 42,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: "#0f172a",
    lineHeight: 1.4,
  },
  header: {
    textAlign: "center",
    marginBottom: 6,
  },
  name: {
    fontSize: 22,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
    letterSpacing: 0.5,
  },
  location: {
    fontSize: 10,
    marginTop: 3,
    textAlign: "center",
    color: "#374151",
  },
  contactLine: {
    fontSize: 10,
    marginTop: 2,
    textAlign: "center",
    color: "#374151",
  },
  sectionTitle: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    marginTop: 12,
    marginBottom: 3,
    borderBottomWidth: 1,
    borderBottomColor: "#0f172a",
    paddingBottom: 1,
  },
  profileText: {
    fontSize: 10,
    lineHeight: 1.45,
    marginTop: 3,
  },
  eduBlock: {
    marginTop: 5,
  },
  eduRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  eduInstitution: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
  },
  eduDates: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
  },
  eduDegree: {
    fontSize: 10,
    fontFamily: "Helvetica-Oblique",
  },
  eduLocation: {
    fontSize: 10,
    fontFamily: "Helvetica-Oblique",
  },
  projectBlock: {
    marginTop: 6,
  },
  projectHeaderLine: {
    fontSize: 10,
  },
  projectName: {
    fontFamily: "Helvetica-Bold",
    fontSize: 10,
  },
  projectTech: {
    fontFamily: "Helvetica-Oblique",
    fontSize: 10,
  },
  projectBullet: {
    fontSize: 10,
    marginTop: 2,
    marginLeft: 14,
    lineHeight: 1.4,
  },
  skillRow: {
    flexDirection: "row",
    marginTop: 3,
  },
  skillCategory: {
    fontFamily: "Helvetica-Bold",
    fontSize: 10,
  },
  skillItems: {
    fontSize: 10,
    flex: 1,
  },
  bulletLine: {
    fontSize: 10,
    marginTop: 2,
    marginLeft: 14,
  },
  declarationText: {
    fontSize: 10,
    marginTop: 4,
  },
});

export function TailoredResumePdf({
  result,
}: {
  result: TailoringResult;
  resumeText?: string;
}) {
  const { candidate, education, projects, skills, certifications } = result;
  const contactParts: string[] = [];
  if (candidate.phone) contactParts.push(candidate.phone);
  if (candidate.email) contactParts.push(candidate.email);
  const contactLine = contactParts.join("   |   ");

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.name}>{candidate.name.toUpperCase()}</Text>
          {candidate.location ? (
            <Text style={styles.location}>{candidate.location}</Text>
          ) : null}
          {contactLine ? (
            <Text style={styles.contactLine}>{contactLine}</Text>
          ) : null}
        </View>

        <Text style={styles.sectionTitle}>Profile</Text>
        <Text style={styles.profileText}>{candidate.profile}</Text>

        {education.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Education</Text>
            {education.map((edu, i) => (
              <View key={i} style={styles.eduBlock}>
                <View style={styles.eduRow}>
                  <Text style={styles.eduInstitution}>{edu.institution}</Text>
                  <Text style={styles.eduDates}>{edu.dates}</Text>
                </View>
                <View style={styles.eduRow}>
                  <Text style={styles.eduDegree}>{edu.degree}</Text>
                  <Text style={styles.eduLocation}>{edu.location}</Text>
                </View>
              </View>
            ))}
          </>
        )}

        {projects.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Projects</Text>
            {projects.map((proj, i) => (
              <View key={i} style={styles.projectBlock}>
                <Text style={styles.projectHeaderLine}>
                  <Text style={styles.projectName}>{proj.name}:</Text>
                  {proj.techStack ? (
                    <Text style={styles.projectTech}>
                      {`   |   ${proj.techStack}`}
                    </Text>
                  ) : null}
                </Text>
                {proj.bullets.map((b, j) => (
                  <Text key={j} style={styles.projectBullet}>
                    {`•  ${b}`}
                  </Text>
                ))}
              </View>
            ))}
          </>
        )}

        {skills.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Technical Skills</Text>
            {skills.map((s, i) => (
              <View key={i} style={styles.skillRow}>
                <Text style={styles.skillCategory}>{s.category} : </Text>
                <Text style={styles.skillItems}>{s.items.join(", ")}</Text>
              </View>
            ))}
          </>
        )}

        {certifications.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Courses and Certifications</Text>
            {certifications.map((cert, i) => (
              <Text key={i} style={styles.bulletLine}>
                {`•  ${cert}`}
              </Text>
            ))}
          </>
        )}

        <Text style={styles.sectionTitle}>Declaration</Text>
        <Text style={styles.declarationText}>
          I hereby declare that all the given above information is true to the
          best of my knowledge.
        </Text>
      </Page>
    </Document>
  );
}

export async function renderTailoredResumeBuffer(
  result: TailoringResult,
  _resumeText: string
): Promise<Buffer> {
  return await renderToBuffer(<TailoredResumePdf result={result} />);
}
