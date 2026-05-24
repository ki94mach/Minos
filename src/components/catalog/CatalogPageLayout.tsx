import React from "react";
import {
  Card,
  CardContent,
  Container,
  Divider,
  List,
  TextField,
  Typography,
} from "@mui/material";
import BackButton from "../BackButton";
import {
  catalogCardSx,
  catalogFormSectionTitleSx,
  catalogListSectionLabelSx,
  catalogListSx,
  catalogPageContainerSx,
  catalogPageTitleSx,
  catalogSearchFieldSx,
  catalogSectionDividerSx,
} from "./catalogPageStyles";

type Props = {
  title: string;
  formTitle: string;
  form: React.ReactNode;
  searchPlaceholder: string;
  searchValue: string;
  onSearchChange: (value: string) => void;
  listLabel?: string;
  error?: string | null;
  listEmpty?: React.ReactNode;
  children: React.ReactNode;
};

export default function CatalogPageLayout({
  title,
  formTitle,
  form,
  searchPlaceholder,
  searchValue,
  onSearchChange,
  listLabel = "Existing items",
  error,
  listEmpty,
  children,
}: Props) {
  const hasListChildren = React.Children.count(children) > 0;

  return (
    <Container maxWidth="md" sx={catalogPageContainerSx}>
      <BackButton />
      <Typography variant="h4" sx={catalogPageTitleSx}>
        {title}
      </Typography>

      <Card variant="outlined" sx={catalogCardSx}>
        <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
          <Typography variant="subtitle1" sx={catalogFormSectionTitleSx}>
            {formTitle}
          </Typography>
          {form}

          {error && (
            <Typography color="error" variant="body2" sx={{ mt: 2 }}>
              {error}
            </Typography>
          )}

          <Divider sx={catalogSectionDividerSx} />

          <Typography component="span" sx={catalogListSectionLabelSx}>
            {listLabel}
          </Typography>
          <TextField
            fullWidth
            size="small"
            label={searchPlaceholder}
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            sx={catalogSearchFieldSx}
          />

          {hasListChildren ? (
            <List disablePadding sx={catalogListSx}>
              {children}
            </List>
          ) : (
            listEmpty
          )}
        </CardContent>
      </Card>
    </Container>
  );
}
