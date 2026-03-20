# Page snapshot

```yaml
- generic [ref=e9]:
  - generic [ref=e10]:
    - img [ref=e12]
    - generic [ref=e14]:
      - heading "Καλώς ήρθατε" [level=1] [ref=e15]
      - paragraph [ref=e16]: Συνδεθείτε στο TenderCopilot GR
  - generic [ref=e17]:
    - generic [ref=e18]:
      - text: Email
      - generic [ref=e19]:
        - img [ref=e20]
        - textbox "Email" [ref=e23]:
          - /placeholder: you@company.gr
    - generic [ref=e24]:
      - text: Κωδικός πρόσβασης
      - generic [ref=e25]:
        - img [ref=e26]
        - textbox "Κωδικός πρόσβασης" [ref=e29]:
          - /placeholder: "********"
        - button "Εμφάνιση κωδικού" [ref=e30]:
          - img [ref=e31]
    - button "Σύνδεση" [ref=e34]:
      - text: Σύνδεση
      - img [ref=e35]
  - generic [ref=e38]: ή
  - button "Συνέχεια με Google" [ref=e39]:
    - img [ref=e40]
    - text: Συνέχεια με Google
  - button "Αποστολή Magic Link" [ref=e45]:
    - img [ref=e46]
    - text: Αποστολή Magic Link
  - paragraph [ref=e49]:
    - text: Δεν έχετε λογαριασμό;
    - link "Εγγραφή" [ref=e50] [cursor=pointer]:
      - /url: /register
```